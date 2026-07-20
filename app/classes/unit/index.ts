import { Assets, AnimatedSprite } from 'pixi.js'
import type { Texture } from 'pixi.js'
import {
  STEP_TIME,
  MAX_SELECT_UNITS,
  WORK_TYPES,
  ACTION_TYPES,
  FAMILY_TYPES,
  RELIEF_LIFT_SMOOTHING,
  SHEET_TYPES,
  LABEL_TYPES,
  SOUND_CUES,
  UNIT_TYPES,
} from '../../constants'
import {
  cartesianToIsometric,
  getInstanceZIndex,
  getGroundReliefLevel,
  getReliefLiftPixels,
  changeSpriteTexturesColorDirectly,
  drawInstanceBlinkingSelection,
  playerCanSeeInstance,
  throttle,
  canUpdateMinimap,
  getWorkWithLoadingType,
  bindAnimatedSpriteToTicker,
  updateInstanceVisibility,
  degreeToDirection,
  getAnimationFrames,
  getSailAnimationFrames,
  playSoundCue,
  playSelectionSound,
  shouldFleeWhenAttacked,
  sendUnitToTransport,
  isTransportBoat,
  canUnitEnterTransport,
  getTransportLoad,
  canUnloadTransport,
  unloadTransport,
  getIconPath,
  getSpriteFrameSelection,
  updateInstanceRenderVisibility,
} from '../../lib'
import { applyBakedLpcUnitAssets, resolveLpcAppearanceVariants } from '../../lib/lpc'
import { Instance } from '../Instance'
import { UnitInterface } from '../../ui/UnitInterface'
import { UnitCommands } from './UnitCommands'
import { UnitLifecycle } from './UnitLifecycle'
import { UnitCombat } from './UnitCombat'
import { UnitActions } from './UnitActions'
import { UnitMovement } from './UnitMovement'
import { t } from '../../lib/lang'
import { applyToolAppearance } from '../../lib/heroTools'
import { getShadowsEnabled, onVisualSettingsChange } from '../../lib/settings'
import {
  canAutoReactToAttack,
  canSelectUnitWithRts,
  canUseRtsEntityPointer,
  isHeroControlled,
} from '../../lib/unitControl'
import type { BuildingEntity, RuntimeEntity, UnitCommandOptions, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { GameContextLike } from '../../types/context'
import type { PlayerLike } from '../../types/player'
import type { AssetAge, SpritesheetLike } from '../../types/pixi'
import type { UnitAppearanceLayerConfig, UnitConfig } from '../../types/config'
import type { SaveDestination, SaveGridPoint, SaveReference } from '../../types/save'

type UnitRestoreReferences = {
  assetAge?: AssetAge
  dest?: RuntimeEntity | RuntimeCell | SaveReference | SaveDestination | null
  previousDest?: RuntimeEntity | RuntimeCell | SaveReference | SaveDestination | null
  realDest?: UnitEntity['realDest'] | SaveDestination | null
  path?: RuntimeCell[] | SaveGridPoint[]
  loadedInTransport?: UnitEntity['loadedInTransport'] | string | null
  buildQueue?: BuildingEntity[] | string[]
  blockedGatherApproach?: UnitEntity['blockedGatherApproach'] | { target: SaveReference; action: string } | null
}

type PositionedConfig = { x?: number; y?: number; z?: number | null }
type RuntimeAppearanceLayer = UnitAppearanceLayerConfig & {
  sprite?: AnimatedSprite
}
const MAIN_SPRITE_LAYER_Z_INDEX = 10
const SHADOW_ALPHA = 0.42
const SHADOW_SCALE_X = 1.05
const SHADOW_SCALE_Y = -0.42

function applyAppearanceVariantsToAssetMap(
  allAssets: UnitEntity['allAssets'],
  variants: Record<string, string> | undefined
): UnitEntity['allAssets'] {
  if (!allAssets || !variants?.skin) return allAssets

  return Object.fromEntries(
    Object.entries(allAssets).map(([work, sheets]) => [
      work,
      Object.fromEntries(
        Object.entries(sheets).map(([sheet, asset]) => [
          sheet,
          /^lpc\/(?:villager|clubman)\/body\//.test(asset) && Assets.cache.get(`${asset}/${variants.skin}`)
            ? `${asset}/${variants.skin}`
            : asset,
        ])
      ),
    ])
  )
}

function applyAppearanceVariantsToAssets(
  assets: UnitEntity['assets'],
  variants: Record<string, string> | undefined
): UnitEntity['assets'] {
  if (!assets || !variants?.skin) return assets

  return Object.fromEntries(
    Object.entries(assets).map(([sheet, asset]) => [
      sheet,
      /^lpc\/(?:villager|clubman)\/body\//.test(asset) && Assets.cache.get(`${asset}/${variants.skin}`)
        ? `${asset}/${variants.skin}`
        : asset,
    ])
  )
}

export type UnitSpawnOptions = Omit<Partial<UnitEntity>, keyof UnitRestoreReferences> &
  UnitRestoreReferences & { i: number; j: number; type: string; owner?: PlayerLike }

function getActionSheet(
  work: string | null | undefined,
  action: string | null | undefined,
  AssetsRef: typeof Assets,
  unit: UnitEntity
) {
  if (!work) {
    return
  }
  const actionSheet = action === ACTION_TYPES.takemeat ? SHEET_TYPES.harvest : SHEET_TYPES.action
  return AssetsRef.cache.get(unit.allAssets?.[work]?.[actionSheet] ?? '')
}

function getFishingOverlayFrames(spritesheet: SpritesheetLike, unit: UnitEntity) {
  const direction = degreeToDirection(unit.degree ?? 0)
  switch (direction) {
    case 'southeast':
      return { textures: getAnimationFrames(spritesheet.textures, 'southwest'), mirrored: true }
    case 'northeast':
      return { textures: getAnimationFrames(spritesheet.textures, 'northwest'), mirrored: true }
    case 'east':
      return { textures: getAnimationFrames(spritesheet.textures, 'west'), mirrored: true }
    default:
      return { textures: getAnimationFrames(spritesheet.textures, direction), mirrored: false }
  }
}

function isEntityDestination(dest: RuntimeEntity | RuntimeCell | null | undefined): dest is RuntimeEntity {
  return Boolean(dest && 'label' in dest)
}

function isDestroyedDestination(dest: RuntimeEntity | RuntimeCell | null | undefined): boolean {
  return isEntityDestination(dest) && Boolean(dest.isDestroyed)
}

function isUnitEntity(instance: RuntimeEntity | null | undefined): instance is UnitEntity {
  return instance?.family === FAMILY_TYPES.unit
}

export class Unit extends Instance implements UnitEntity {
  unitInterface: UnitInterface
  unitCommands: UnitCommands
  unitLifecycle: UnitLifecycle
  unitCombat: UnitCombat
  unitActions: UnitActions
  unitMovement: UnitMovement
  sendTo!: (target: RuntimeCell | RuntimeEntity, action?: string) => void

  declare sprite: AnimatedSprite
  shadow: AnimatedSprite | null
  appearanceLayerSprites: Map<number, AnimatedSprite>
  declare reliefLift: number
  sheetDirectionCounts?: Record<string, number>
  sheetDirectionOrders?: Record<string, string[]>
  spriteScale?: number
  loadedInTransport: UnitEntity['loadedInTransport']
  controlMode!: NonNullable<UnitEntity['controlMode']>
  inactif!: boolean
  sounds?: UnitEntity['sounds']
  work: UnitEntity['work']
  loading!: UnitEntity['loading']
  loadingType: UnitEntity['loadingType']
  transportCapacity?: UnitEntity['transportCapacity']
  transportedUnits?: UnitEntity['transportedUnits']
  transportLoadShoreCell?: UnitEntity['transportLoadShoreCell']
  transportLoadCoastCell?: UnitEntity['transportLoadCoastCell']

  dest: UnitEntity['dest']
  realDest: UnitEntity['realDest']
  previousDest: UnitEntity['previousDest']
  previousWork: UnitEntity['previousWork']
  path!: NonNullable<UnitEntity['path']>
  pendingOrder: UnitEntity['pendingOrder']
  blockedGatherApproach: UnitEntity['blockedGatherApproach']
  buildQueue!: NonNullable<UnitEntity['buildQueue']>
  currentCell!: NonNullable<UnitEntity['currentCell']>
  visibleCells!: NonNullable<UnitEntity['visibleCells']>

  actionLocked!: boolean
  currentSheet!: NonNullable<UnitEntity['currentSheet']>
  currentFrame!: NonNullable<UnitEntity['currentFrame']>
  actionSheet?: UnitEntity['actionSheet']
  walkingSheet?: UnitEntity['walkingSheet']
  standingSheet?: UnitEntity['standingSheet']
  loop?: UnitEntity['loop']
  visibilityTimeout?: UnitEntity['visibilityTimeout']
  sailSheet?: UnitEntity['sailSheet']
  sailSpritesheet?: UnitEntity['sailSpritesheet']
  sailSprite?: UnitEntity['sailSprite']
  sailAnimationSpeed?: UnitEntity['sailAnimationSpeed']
  fishingOverlaySheet?: UnitEntity['fishingOverlaySheet']
  fishingOverlaySprite?: UnitEntity['fishingOverlaySprite']
  showLoading?: UnitEntity['showLoading']
  showBuildings?: UnitEntity['showBuildings']
  visualSettingsCleanup: (() => void) | null

  assets?: UnitEntity['assets']
  allAssets?: UnitEntity['allAssets']
  appearance?: UnitEntity['appearance']
  appearanceVariants?: UnitEntity['appearanceVariants']

  totalQuantity?: UnitEntity['totalQuantity']
  quantity!: number
  experience!: NonNullable<UnitEntity['experience']>

  interface!: UnitEntity['interface']
  handleSetDest?: UnitEntity['handleSetDest']
  handleIsAttacked?: UnitEntity['handleIsAttacked']

  constructor(options: UnitSpawnOptions, context: GameContextLike) {
    super(context)
    this.selectionFactor = 0.5

    const {
      context: { map, menu },
    } = this
    this.family = FAMILY_TYPES.unit
    this.unitInterface = new UnitInterface(this)
    this.unitCommands = new UnitCommands(this)
    this.unitLifecycle = new UnitLifecycle(this)
    this.unitCombat = new UnitCombat(this)
    this.unitActions = new UnitActions(this)
    this.unitMovement = new UnitMovement(this)
    this.shadow = null
    this.visualSettingsCleanup = null
    this.appearanceLayerSprites = new Map()
    this.reliefLift = 0

    this.dest = null
    this.realDest = null
    this.previousDest = null
    this.previousWork = null
    this.blockedGatherApproach = null
    this.buildQueue = []
    this.path = []
    this.degree = map.randomRange(1, 360)
    this.currentFrame = map.randomRange(0, 4)
    this.action = null
    this.controlMode = 'rts'
    this.actionLocked = false
    this.pendingOrder = null
    this.loading = 0
    this.loadingType = null
    this.currentSheet = SHEET_TYPES.standing
    this.inactif = true
    this.experience = {}
    Object.assign(this, options)
    const unitConfig = this.owner.config.units[this.type] as (typeof this.owner.config.units)[string] & PositionedConfig
    Object.assign(this, unitConfig)
    if (this.appearance) {
      this.appearance = { ...this.appearance, layers: this.appearance.layers.map(layer => ({ ...layer })) }
      this.appearanceVariants =
        this.appearanceVariants ??
        resolveLpcAppearanceVariants(this.owner.civ, `${this.owner.label}:${this.label}:${this.i}:${this.j}`)
      this.assets = applyAppearanceVariantsToAssets(this.assets, this.appearanceVariants)
      this.allAssets = applyAppearanceVariantsToAssetMap(this.allAssets, this.appearanceVariants)
    }
    applyBakedLpcUnitAssets(this)
    this.size = 1
    this.visible = false
    this.visibleCells = new Set()
    const spawnCell = map.grid[this.i][this.j]
    const [flatSpawnX, flatSpawnY] = cartesianToIsometric(this.i, this.j)
    this.x = unitConfig.x ?? options.x ?? flatSpawnX
    this.y = unitConfig.y ?? options.y ?? flatSpawnY
    this.z = unitConfig.z ?? options.z ?? spawnCell.z
    this.zIndex = getInstanceZIndex(this)
    this.quantity = this.quantity ?? this.totalQuantity
    this.hitPoints = this.hitPoints ?? this.totalHitPoints
    if (this.transportCapacity) this.transportedUnits = this.transportedUnits || []

    this.currentCell = map.grid[this.i][this.j]
    if (this.currentSheet === SHEET_TYPES.corpse) {
      this.owner.corpses.push(this)
      map.grid[this.i][this.j].corpses.add(this)
    } else if (!this.isDead) {
      this.currentCell.place(this)
      this.currentCell.solid = true
      this.owner.units.push(this)
      map.addToInstanceBucket(this)
    }
    switch (this.type) {
      case UNIT_TYPES.villager:
        this.work = this.work || null
        break
      case 'Priest':
        this.work = WORK_TYPES.healer
        break
      default:
        this.work = WORK_TYPES.attacker
    }

    if (this.assets) {
      for (const [key, value] of Object.entries(this.assets)) {
        Object.assign(this, { [key]: Assets.cache.get(value) as SpritesheetLike | undefined })
      }
    } else if (this.allAssets) {
      for (const [key, value] of Object.entries(this.allAssets.default)) {
        Object.assign(this, { [key]: Assets.cache.get(value) as SpritesheetLike | undefined })
      }
    }
    if (this.sailSheet) {
      this.sailSpritesheet = Assets.cache.get(this.sailSheet)
    }

    if (this.owner.isPlayed && map.ready && this.context.controls.instanceIsAudible?.(this)) {
      playSoundCue((this.sounds && this.sounds.create) || SOUND_CUES.unit.fallbackCreate)
    }

    this.interface = {
      info: (element: HTMLElement) => {
        const data = this.owner.config.units[this.type]
        this.setDefaultInterface(element, data)
        if (this.showLoading && this.owner.isPlayed) {
          element.appendChild(this.getLoadingElement())
        }
      },
      menu:
        this.owner.isPlayed && !this.context.editor
          ? [
              ...(this.showBuildings
                ? [
                    {
                      id: 'build',
                      icon: getIconPath('002_50721'),
                      tooltip: () => ({
                        title: t('buildMenu'),
                        description: t('buildMenuDescription'),
                      }),
                      children: Object.keys(this.owner.config.buildings)
                        .map(key => menu.getActionBuildingButton?.(key, this.owner))
                        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
                    },
                  ]
                : []),
              ...(this.transportCapacity
                ? [
                    {
                      id: 'unload',
                      icon: getIconPath('001_50721'),
                      hide: () => !getTransportLoad(this),
                      tooltip: () => ({
                        title: t('unloadTransport'),
                        description: t('unloadTransportDescription'),
                      }),
                      onClick: (selection: RuntimeEntity) => {
                        if (!canUnloadTransport(selection)) {
                          menu.showMessage(t('transportUnloadNeedsCoast'), 'warning')
                          return
                        }
                        const unloaded = unloadTransport(selection)
                        if (unloaded && selection.owner?.isPlayed) {
                          menu.setBottombar(selection)
                          menu.updatePlayerMiniMapEvt?.(selection.owner)
                        }
                      },
                    },
                  ]
                : []),
            ]
          : [],
    }

    this.eventMode = 'static'
    this.actionSheet = this.actionSheet || getActionSheet(this.work, this.action, Assets, this)
    this.sprite = new AnimatedSprite(
      getAnimationFrames((this.standingSheet as { textures: Record<string, Texture> }).textures, 'south') as Texture[]
    )
    bindAnimatedSpriteToTicker(this.sprite, this.context.app)
    this.sprite.label = LABEL_TYPES.sprite
    this.sprite.eventMode = 'auto'
    this.sprite.roundPixels = true
    this.sprite.loop = this.loop ?? true
    this.sprite.zIndex = MAIN_SPRITE_LAYER_Z_INDEX
    this.shadow = this.createShadow()
    this.addChild(this.shadow, this.sprite)
    this.visualSettingsCleanup = onVisualSettingsChange(() => this.syncVisualSettings())
    if (this.isDead) {
      this.currentSheet === SHEET_TYPES.corpse ? this.decompose() : this.death()
    } else if ((this.loading ?? 0) > 0) {
      const loadingWork = getWorkWithLoadingType(this.loadingType ?? '')
      this.walkingSheet = this.allAssets?.[loadingWork] && Assets.cache.get(this.allAssets[loadingWork].loadedSheet)
      this.standingSheet = this.allAssets?.[loadingWork] && Assets.cache.get(this.allAssets[loadingWork].standingSheet)
    }
    this.setTextures(this.currentSheet)

    this.sprite.currentFrame = Math.min(this.currentFrame, this.sprite.textures.length - 1)
    this.syncShadow()
    this.syncAppearanceLayers(this.currentSheet)
    this.applyReliefLift(getGroundReliefLevel(spawnCell), true)
    this.sprite.updateAnchor = true
    this.setupSailSprite()
    this.syncFishingOverlaySprite()
    if (this.shouldKeepHealthBarVisible()) this.drawHealthBar()

    this.sendTo = this.owner.isPlayed
      ? throttle(
          (target: RuntimeCell | RuntimeEntity, action?: string) => {
            this.sendToEvt(target, action)
          },
          100,
          true
        )
      : (target: RuntimeCell | RuntimeEntity, action?: string) => {
          this.sendToEvt(target, action)
        }

    this.on('pointerdown', evt => {
      const {
        context: { controls, player, editor },
      } = this
      if (editor) return
      if (!canUseRtsEntityPointer(controls)) return
      if (
        controls.rallyPointController?.active ||
        controls.mouseBuilding ||
        controls.mouseRectangle ||
        !controls.isMouseInApp?.(evt)
      ) {
        return
      }
      if (controls.consumeUnitDoubleClick?.(this)) {
        if (this.owner.isPlayed) {
          const selectedUnits = new Set(player.selectedUnits)
          controls.getCellOnCamera?.((cell: RuntimeCell) => {
            const has = isUnitEntity(cell.has) ? cell.has : null
            if (
              player.selectedUnits.length < MAX_SELECT_UNITS &&
              has &&
              has.owner &&
              has.owner.label === this.owner.label &&
              has.type === this.type &&
              !has.loadedInTransport &&
              canSelectUnitWithRts(has) &&
              !selectedUnits.has(has)
            ) {
              selectedUnits.add(has)
              has.select?.()
              player.selectedUnits.push(has)
            }
          })
        }
      }
    })
    this.on('pointerup', evt => {
      const {
        context: { controls, player, menu, editor },
      } = this
      if (editor?.handleEntityInteraction?.(this)) return
      if (!canUseRtsEntityPointer(controls)) return
      if (controls.rallyPointController?.active) {
        controls.mouse.prevent = true
        controls.rallyPointController.handleMouseUpOnEntity(this)
        return
      }
      if (
        controls.doubleClicked ||
        controls.mouseBuilding ||
        controls.mouseRectangle ||
        !controls.isMouseInApp?.(evt)
      ) {
        return
      }

      controls.mouse.prevent = true
      controls.registerUnitClick?.(this)

      if (this.owner.isPlayed) {
        if (isTransportBoat(this) && player.selectedUnits.length) {
          const hasTransportLoadCandidate = player.selectedUnits.some((playerUnit: UnitEntity) =>
            canUnitEnterTransport(playerUnit, this)
          )
          let hasSentTransportLoad = false
          for (const playerUnit of [...player.selectedUnits]) {
            if (sendUnitToTransport(playerUnit, this)) hasSentTransportLoad = true
          }
          if (hasSentTransportLoad || hasTransportLoadCandidate) {
            drawInstanceBlinkingSelection(this)
            return
          }
        }
        let hasSentHealer = false
        if (player.selectedUnits.length) {
          for (let i = 0; i < player.selectedUnits.length; i++) {
            const playerUnit = player.selectedUnits[i]
            if (playerUnit.work === WORK_TYPES.healer && playerUnit.getActionCondition?.(this, ACTION_TYPES.heal)) {
              hasSentHealer = true
              playerUnit.sendTo?.(this, ACTION_TYPES.heal)
            }
          }
        }
        if (hasSentHealer) {
          drawInstanceBlinkingSelection(this)
        } else if (player.selectedUnit !== this) {
          this.owner.unselectAll()
          this.select()
          menu.setBottombar(this)
          player.selectedUnit = this
          player.selectedUnits = [this]
        }
      } else {
        let hasSentConverter = false
        let hasSentAttacker = false
        if (player.selectedUnits.length) {
          for (let i = 0; i < player.selectedUnits.length; i++) {
            const playerUnit = player.selectedUnits[i]
            if (playerUnit.work === WORK_TYPES.healer && playerUnit.getActionCondition?.(this, ACTION_TYPES.convert)) {
              hasSentConverter = true
              playerUnit.sendToConvert?.(this)
              continue
            }
            if (this.getActionCondition(playerUnit, ACTION_TYPES.attack))
              if (playerUnit.type === UNIT_TYPES.villager) {
                hasSentAttacker = true
                playerUnit.sendToAttack?.(this)
              } else if (playerUnit.work === WORK_TYPES.attacker) {
                hasSentAttacker = true
                playerUnit.sendTo?.(this, ACTION_TYPES.attack)
              }
          }
        }
        if (hasSentConverter || hasSentAttacker) {
          drawInstanceBlinkingSelection(this)
        } else if ((player.selectedOther !== this && playerCanSeeInstance(this, player)) || map.revealEverything) {
          player.unselectAll()
          this.select()
          menu.setBottombar(this)
          player.selectedOther = this
          playSelectionSound(this)
        }
      }
    })

    this.visibilityTimeout = setTimeout(() => {
      if (!this.isDestroyed) updateInstanceVisibility(this)
    })
  }

  setupSailSprite() {
    if (!this.sailSpritesheet?.textures) return

    const { textures, mirrored } = getSailAnimationFrames(this.sailSpritesheet.textures, this)
    if (!textures.length) return

    this.sailSprite = new AnimatedSprite(textures as Texture[])
    bindAnimatedSpriteToTicker(this.sailSprite, this.context.app)
    this.sailSprite.label = LABEL_TYPES.sail
    this.sailSprite.eventMode = 'none'
    this.sailSprite.roundPixels = true
    this.sailSprite.loop = true
    this.sailSprite.updateAnchor = true
    this.sailSprite.animationSpeed = this.sailSpritesheet.data?.animationSpeed ?? this.sailAnimationSpeed ?? 0.18
    this.sailSprite.scale.x = mirrored ? -1 : 1
    this.sailSprite.play()
    this.addChild(this.sailSprite)
  }

  syncSailSprite(goto: number | null = null) {
    if (!this.sailSprite || this.isDead || !this.sailSpritesheet?.textures) {
      if (this.sailSprite) this.sailSprite.visible = false
      return
    }

    const { textures, mirrored } = getSailAnimationFrames(this.sailSpritesheet.textures, this)
    if (!textures.length) {
      this.sailSprite.visible = false
      return
    }

    this.sailSprite.visible = true
    this.sailSprite.textures = textures as Texture[]
    this.sailSprite.scale.x = mirrored ? -1 : 1
    this.sailSprite.animationSpeed = this.sailSpritesheet.data?.animationSpeed ?? this.sailAnimationSpeed ?? 0.18
    goto && goto < this.sailSprite.textures.length ? this.sailSprite.gotoAndPlay(goto) : this.sailSprite.play()
  }

  setupFishingOverlaySprite() {
    if (!this.fishingOverlaySheet?.textures || this.fishingOverlaySprite) return

    const { textures, mirrored } = getFishingOverlayFrames(this.fishingOverlaySheet, this)
    if (!textures.length) return

    this.fishingOverlaySprite = new AnimatedSprite(textures as Texture[])
    bindAnimatedSpriteToTicker(this.fishingOverlaySprite, this.context.app)
    this.fishingOverlaySprite.label = LABEL_TYPES.fishingNet
    this.fishingOverlaySprite.eventMode = 'none'
    this.fishingOverlaySprite.roundPixels = true
    this.fishingOverlaySprite.loop = false
    this.fishingOverlaySprite.updateAnchor = true
    this.fishingOverlaySprite.zIndex = 3
    this.fishingOverlaySprite.scale.x = mirrored ? -1 : 1
    this.fishingOverlaySprite.animationSpeed = this.fishingOverlaySheet.data?.animationSpeed ?? 0.3
    this.fishingOverlaySprite.stop()
    this.addChild(this.fishingOverlaySprite)
  }

  removeFishingOverlaySprite() {
    if (!this.fishingOverlaySprite) return
    this.fishingOverlaySprite.parent?.removeChild(this.fishingOverlaySprite)
    this.fishingOverlaySprite.destroy({ children: true, texture: false })
    this.fishingOverlaySprite = null
  }

  syncFishingOverlaySprite() {
    const shouldShow =
      !this.isDead &&
      this.action === ACTION_TYPES.fishing &&
      this.currentSheet === SHEET_TYPES.action &&
      this.fishingOverlaySheet?.textures

    if (!shouldShow) {
      this.removeFishingOverlaySprite()
      return
    }

    this.setupFishingOverlaySprite()
    if (!this.fishingOverlaySprite || !this.fishingOverlaySheet) return

    const { textures, mirrored } = getFishingOverlayFrames(this.fishingOverlaySheet, this)
    if (!textures.length) {
      this.removeFishingOverlaySprite()
      return
    }
    this.fishingOverlaySprite.textures = textures as Texture[]
    this.fishingOverlaySprite.scale.x = mirrored ? -1 : 1
    this.fishingOverlaySprite.gotoAndStop(0)
  }

  createShadow() {
    const shadow = new AnimatedSprite(this.sprite.textures as Texture[])
    bindAnimatedSpriteToTicker(shadow, this.context.app)
    shadow.label = LABEL_TYPES.shadow
    shadow.eventMode = 'none'
    shadow.roundPixels = true
    shadow.tint = 0x000000
    shadow.alpha = SHADOW_ALPHA
    shadow.zIndex = -2
    this.syncShadow(shadow)
    return shadow
  }

  syncShadow(shadow = this.shadow) {
    if (!shadow || !this.sprite) return
    const frame = Math.min(this.sprite.currentFrame, Math.max(this.sprite.textures.length - 1, 0))
    shadow.visible = getShadowsEnabled() && !this.loadedInTransport
    shadow.textures = this.sprite.textures
    shadow.animationSpeed = this.sprite.animationSpeed
    shadow.loop = this.sprite.loop
    shadow.anchor.set(this.sprite.anchor.x, this.sprite.anchor.y)
    shadow.alpha = SHADOW_ALPHA
    shadow.rotation = 0
    shadow.scale.x = this.sprite.scale.x * SHADOW_SCALE_X
    shadow.scale.y = Math.abs(this.sprite.scale.y) * SHADOW_SCALE_Y
    // The shadow rises/sinks with the sprite on relief (both stand on the same raised
    // ground) — unlike a flying animal's shadow, which stays pinned to the ground.
    shadow.position.set(0, this.reliefLift)
    if (this.sprite.playing) {
      shadow.gotoAndPlay(frame)
    } else {
      shadow.gotoAndStop(frame)
    }
  }

  syncVisualSettings(): void {
    if (this.shadow) {
      this.shadow.visible = getShadowsEnabled() && !this.loadedInTransport
    }
  }

  // Render-only: this is the SOLE source of visual relief for the unit — this.x/y stay flat
  // (pathing/collision/zIndex), so this offsets the sprite, shadow and equipment layers to
  // represent the ground relief level (fractional on slopes — see getGroundReliefLevel).
  // Eased toward the target unless immediate, since the underfoot sampling can step at tile
  // boundaries. Never touches this.x/y or zIndex.
  applyReliefLift(level: number, immediate = false): void {
    const target = -getReliefLiftPixels(level)
    this.reliefLift = immediate ? target : this.reliefLift + (target - this.reliefLift) * RELIEF_LIFT_SMOOTHING
    this.sprite.position.y = this.reliefLift
    if (this.shadow) this.shadow.position.y = this.reliefLift
    for (const layerSprite of this.appearanceLayerSprites.values()) {
      layerSprite.position.y = this.reliefLift
    }
    const healthBar = this.getChildByLabel(LABEL_TYPES.healthBar)
    if (healthBar) healthBar.position.y = this.reliefLift
    const powerBar = this.getChildByLabel(LABEL_TYPES.powerBar)
    if (powerBar) powerBar.position.y = this.reliefLift
  }

  syncAppearanceLayers(sheet: string) {
    const layers = this.appearance?.layers
    const hideEquipment = sheet === SHEET_TYPES.dying || sheet === SHEET_TYPES.corpse
    if (!layers?.length || hideEquipment) {
      for (const sprite of this.appearanceLayerSprites.values()) {
        sprite.parent?.removeChild(sprite)
        sprite.destroy({ children: true, texture: false })
      }
      this.appearanceLayerSprites.clear()
      return
    }

    const heroControlled = isHeroControlled(this)
    const liveLayers = new Set<number>()
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i] as RuntimeAppearanceLayer
      const isLayerEnabledForWork =
        !layer.workTypes?.length || (this.work ? layer.workTypes.includes(this.work) : false)
      const isLoading = (this.loading ?? 0) > 0
      // The hero never wears the carried-resource overlay (meat/stone/gold) — carried
      // resources show up in the hero HUD instead — and keeps its tool equipped while loading.
      const isLayerHiddenByLoading = heroControlled
        ? Boolean(layer.showWhenLoading)
        : Boolean(layer.hideWhenLoading && isLoading) || Boolean(layer.showWhenLoading && !isLoading)
      const isLayerHiddenByAction = Boolean(this.action && layer.hideForActions?.includes(this.action))
      const loadedSheetOverride =
        this.loading && sheet === SHEET_TYPES.walking ? (layer.loadedSheet as string | undefined) : undefined
      const actionWorkSheetOverride =
        this.work && this.action ? layer.actionWorkSheetOverrides?.[`${this.work}:${this.action}`]?.[sheet] : undefined
      const workSheetOverride = this.work ? layer.workSheetOverrides?.[this.work]?.[sheet] : undefined
      const baseSheetId =
        loadedSheetOverride ??
        actionWorkSheetOverride ??
        workSheetOverride ??
        (layer[sheet as keyof RuntimeAppearanceLayer] as string | undefined)
      const playerColorVariant = this.owner.color ? layer.playerColorVariants?.[this.owner.color] : undefined
      const appearanceVariant = layer.appearanceVariantKey
        ? this.appearanceVariants?.[layer.appearanceVariantKey]
        : undefined
      const variantSheetId =
        baseSheetId && appearanceVariant
          ? `${baseSheetId}/${appearanceVariant}${playerColorVariant ? `/${playerColorVariant}` : ''}`
          : null
      const basePlayerColorSheetId =
        baseSheetId && playerColorVariant ? `${baseSheetId}/${playerColorVariant}` : baseSheetId
      const sheetId = variantSheetId && Assets.cache.get(variantSheetId) ? variantSheetId : basePlayerColorSheetId
      const spritesheet = sheetId ? (Assets.cache.get(sheetId) as SpritesheetLike | undefined) : undefined
      const spriteKey = i
      liveLayers.add(spriteKey)

      if (
        !isLayerEnabledForWork ||
        isLayerHiddenByLoading ||
        isLayerHiddenByAction ||
        !sheetId ||
        !spritesheet?.textures
      ) {
        const existing = this.appearanceLayerSprites.get(spriteKey)
        if (existing) {
          existing.parent?.removeChild(existing)
          existing.destroy({ children: true, texture: false })
          this.appearanceLayerSprites.delete(spriteKey)
        }
        continue
      }

      const directionCount = layer.sheetDirectionCounts?.[sheet] ?? this.sheetDirectionCounts?.[sheet] ?? null
      const directionOrderOverride = (layer.sheetDirectionOrders?.[sheet] ??
        this.sheetDirectionOrders?.[sheet] ??
        null) as string[] | null
      const { textures, mirrored } = getSpriteFrameSelection(
        spritesheet.textures,
        this.degree,
        directionCount,
        directionOrderOverride
      )

      let layerSprite = this.appearanceLayerSprites.get(spriteKey)
      const frameIndex = Math.min(this.sprite.currentFrame, Math.max(textures.length - 1, 0))

      if (!layerSprite) {
        layerSprite = new AnimatedSprite(textures as Texture[])
        bindAnimatedSpriteToTicker(layerSprite, this.context.app)
        layerSprite.label = `${LABEL_TYPES.sprite}-layer-${spriteKey}`
        layerSprite.eventMode = 'none'
        layerSprite.position.y = this.sprite.position.y
        layerSprite.roundPixels = true
        layerSprite.loop = this.loop ?? true
        layerSprite.updateAnchor = true
        layerSprite.zIndex = layer.zIndex
        if (layer.zIndex < MAIN_SPRITE_LAYER_Z_INDEX) {
          this.addChildAt(layerSprite, Math.max(0, this.getChildIndex(this.sprite)))
        } else {
          this.addChild(layerSprite)
        }
        this.appearanceLayerSprites.set(spriteKey, layerSprite)
      }

      layerSprite.visible = true
      layerSprite.zIndex = layer.zIndex
      layerSprite.textures = textures as Texture[]
      const spriteScale = this.spriteScale ?? 1
      layerSprite.scale.x = mirrored ? -spriteScale : spriteScale
      layerSprite.scale.y = spriteScale
      const defaultAnchor = (layerSprite.textures[0] as Texture & { defaultAnchor?: { x: number; y: number } })
        .defaultAnchor
      if (defaultAnchor) {
        layerSprite.anchor.set(defaultAnchor.x, defaultAnchor.y)
      }
      layerSprite.animationSpeed = spritesheet.data?.animationSpeed ?? 0.18
      layerSprite.currentFrame = frameIndex
      if (this.sprite.playing) {
        layerSprite.gotoAndPlay(frameIndex)
      } else {
        layerSprite.gotoAndStop(frameIndex)
      }
    }

    for (const [spriteKey, sprite] of this.appearanceLayerSprites.entries()) {
      if (liveLayers.has(spriteKey)) continue
      sprite.parent?.removeChild(sprite)
      sprite.destroy({ children: true, texture: false })
      this.appearanceLayerSprites.delete(spriteKey)
    }
  }

  override setTextures(sheet: string) {
    super.setTextures(sheet)
    this.applyOwnerColorToSprite()
    this.syncShadow()
    this.syncAppearanceLayers(sheet)
    this.syncSailSprite(this.sailSprite?.currentFrame)
    this.syncFishingOverlaySprite()
  }

  applyOwnerColorToSprite() {
    if (!this.sprite?.textures?.length) return

    const frame = this.sprite.currentFrame
    const playing = this.sprite.playing
    const textures = changeSpriteTexturesColorDirectly(this.sprite.textures as Texture[], this.owner.color ?? '')
    this.sprite.filters = null
    this.sprite.textures = textures as Texture[]

    const restoredFrame = Math.min(frame, Math.max(textures.length - 1, 0))
    if (playing) {
      this.sprite.gotoAndPlay(restoredFrame)
    } else {
      this.sprite.gotoAndStop(restoredFrame)
    }
  }

  override pause() {
    super.pause()
    this.shadow?.stop()
    for (const sprite of this.appearanceLayerSprites.values()) {
      sprite.stop()
    }
  }

  override resume() {
    if (this.currentSheet === SHEET_TYPES.standing) {
      this.sprite.gotoAndStop(this.sprite.currentFrame)
      this.shadow?.gotoAndStop(this.shadow.currentFrame)
      for (const sprite of this.appearanceLayerSprites.values()) {
        sprite.gotoAndStop(sprite.currentFrame)
      }
      return
    }
    super.resume()
    this.shadow?.play()
    for (const sprite of this.appearanceLayerSprites.values()) {
      sprite.play()
    }
  }

  override select() {
    if (this.loadedInTransport) return
    if (this.selected) return
    super.select()
    const {
      context: { menu, player },
    } = this
    canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt?.(this.owner)
  }

  override unselect() {
    if (!this.selected) return
    super.unselect()
    const {
      context: { menu, player },
    } = this
    canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt?.(this.owner)
  }

  override hasPath() {
    return this.path.length > 0
  }

  setDest(dest: RuntimeEntity | RuntimeCell | null) {
    if (!dest || isDestroyedDestination(dest)) {
      this.stop()
      return
    }
    this.handleSetDest && this.handleSetDest(dest, this)
    this.dest = dest
    this.realDest = {
      i: dest.i,
      j: dest.j,
      x: dest.x,
      y: dest.y,
      label: isEntityDestination(dest) ? dest.label : '',
    }
  }

  setPath(path: RuntimeCell[]) {
    if (!path.length) {
      this.stop()
      return
    }
    this.setTextures(SHEET_TYPES.walking)
    this.inactif = false
    this.path = path
    this.startInterval(() => this.step(), STEP_TIME, true, 'unit.step')
  }

  queueOrder(orderOrDest: (() => void) | RuntimeEntity | RuntimeCell, action: string | null = null): boolean {
    if (typeof orderOrDest === 'function') {
      this.pendingOrder = { execute: orderOrDest }
      return true
    }

    const dest = orderOrDest
    if (!dest || isDestroyedDestination(dest)) return false
    this.pendingOrder = { dest, action }
    return true
  }

  flushPendingOrder(): boolean {
    if (!this.pendingOrder || this.isDead) return false
    const pendingOrder = this.pendingOrder
    this.pendingOrder = null
    if (typeof pendingOrder.execute === 'function') {
      pendingOrder.execute()
      return true
    }
    const { dest, action } = pendingOrder
    if (!dest || isDestroyedDestination(dest)) return false
    this.sendToEvt(dest, action ?? null)
    return true
  }

  handleChangeDest() {
    const dest = this.dest
    if (dest && 'isUsedBy' in dest && dest.isUsedBy === this) {
      dest.isUsedBy = null
    }
  }

  sendToEvt(
    dest: RuntimeEntity | RuntimeCell | null,
    action?: string | null,
    options?: { forceRepath?: boolean; allowBlockedGatherApproach?: boolean }
  ) {
    return this.unitMovement.sendToEvt(dest, action ?? null, options)
  }

  goBackToPrevious() {
    return this.unitActions.goBackToPrevious()
  }

  startGathering(
    loadingType: string,
    soundId: string | string[] | null | undefined,
    opts?: { dieOnEmpty?: boolean; checkOwner?: boolean; updateTexture?: boolean }
  ) {
    return this.unitActions.startGathering(loadingType, soundId, opts)
  }

  getAction(name: string) {
    return this.unitActions.getAction(name)
  }

  detect(instance: RuntimeEntity | null) {
    return this.unitCombat.detect(instance)
  }

  handleAffectNewDestHunter() {
    return this.unitCombat.handleAffectNewDestHunter()
  }

  upgrade(type: string) {
    return this.unitActions.upgrade(type)
  }

  affectNewDest() {
    return this.unitMovement.affectNewDest()
  }

  isUnitAtDest(action: string | null | undefined, dest: RuntimeEntity | RuntimeCell | null | undefined) {
    return this.unitMovement.isUnitAtDest(action, dest)
  }

  destHasMoved() {
    return this.unitMovement.destHasMoved()
  }

  override moveToPath() {
    return this.unitMovement.moveToPath()
  }

  moveDirect(dirX: number, dirY: number, distance: number): boolean {
    return this.unitMovement.moveDirect(dirX, dirY, distance)
  }

  isAttacked(instance: RuntimeEntity | null) {
    if (this.context.editor) {
      return
    }
    if (!instance || this.isDead) {
      return
    }
    if (!canAutoReactToAttack(this)) {
      return
    }
    this.owner.reportThreat?.(this, instance)
    if (shouldFleeWhenAttacked(this)) {
      this.runaway(instance)
      return
    }
    if (!this.getActionCondition(instance, ACTION_TYPES.attack)) {
      return
    }
    if (this.dest === instance) {
      return
    }
    if (this.handleIsAttacked?.(instance, this)) return
    const currentDest = this.dest
    if (this.type === UNIT_TYPES.villager) {
      if (instance.family === FAMILY_TYPES.animal) {
        this.sendToHunt(instance)
      } else {
        this.sendToAttack(instance)
      }
    } else {
      this.sendTo(instance, ACTION_TYPES.attack)
    }
    this.previousDest = currentDest
  }

  stop() {
    const heroControlled = isHeroControlled(this)
    if (!heroControlled && this.currentCell.has?.label !== this.label && this.currentCell.solid) {
      this.sendTo(this.currentCell)
      return
    }
    this.handleChangeDest()
    this.actionLocked = false
    this.pendingOrder = null
    this.blockedGatherApproach = null
    this.inactif = true
    this.action = null
    this.dest = null
    this.realDest = null
    this.transportLoadShoreCell = null
    this.transportLoadCoastCell = null
    if (heroControlled) {
      if (this.currentCell.has === this) {
        this.currentCell.has = null
        this.currentCell.solid = false
      }
      updateInstanceRenderVisibility(this)
      this.visible = true
      // Gather-style actions (takemeat, hunt, chopwood, ...) reassign `work` to a
      // fixed economy bucket while running, e.g. bare-handed meat pickup goes through
      // the hunter bucket. Nothing else restores it afterward, so the hero would keep
      // showing that bucket's equipment (a bow) once idle. Snap back to whatever the
      // equipped tool actually implies.
      applyToolAppearance(this, this.context?.controls?.equippedTool ?? 'unarmed')
    } else if (!this.currentCell.has || this.currentCell.has === this || this.currentCell.has.isDestroyed) {
      this.currentCell.place(this)
      this.currentCell.solid = true
    }
    this.path = []
    this.stopInterval()
    this.setTextures(SHEET_TYPES.standing)
  }

  override startInterval(callback: () => void, time: number, immediate = true, name = 'unit.interval') {
    if (this.isDead) {
      return
    }
    this.stopInterval()
    this.interval = this.context.scheduler.add(callback, time, name)
    if (immediate) callback()
  }

  explore() {
    return this.unitMovement.explore()
  }

  runaway(instance: RuntimeEntity) {
    return this.unitMovement.runaway(instance)
  }

  decompose() {
    return this.unitLifecycle.decompose()
  }

  death() {
    return this.unitLifecycle.death()
  }

  override die() {
    return this.unitLifecycle.die()
  }

  clear() {
    return this.unitLifecycle.clear()
  }

  updateInterfaceLoading() {
    this.unitInterface.updateLoading()
  }

  getLoadingElement() {
    return this.unitInterface.getLoadingElement()
  }

  commonSendTo(
    target: RuntimeEntity,
    work: string,
    action: string | null,
    keepPrevious: boolean | UnitCommandOptions,
    immediate = false,
    preserveBuildQueue = false
  ) {
    return this.unitCommands.commonSendTo(target, work, action, keepPrevious, immediate, preserveBuildQueue)
  }

  // Navigate to arrivalCell but set target as the attack dest.
  // Avoids the N×M A* calls getInstanceClosestFreeCellPath makes when multiple
  // units are sent to the same solid target — each unit gets exactly one A* call.
  sendToWithCell(target: RuntimeEntity, arrivalCell: RuntimeCell, action: string) {
    return this.unitCommands.sendToWithCell(target, arrivalCell, action)
  }

  sendToDelivery() {
    return this.unitCommands.sendToDelivery()
  }

  sendToFish(target: RuntimeEntity, immediate = false) {
    return this.unitCommands.sendToFish(target, immediate)
  }

  sendToAttack(target: RuntimeEntity) {
    return this.unitCommands.sendToAttack(target)
  }

  sendToConvert(target: RuntimeEntity) {
    return this.unitCommands.sendToConvert(target)
  }

  sendToTakeMeat(target: RuntimeEntity, immediate = false) {
    return this.unitCommands.sendToTakeMeat(target, immediate)
  }

  sendToHunt(target: RuntimeEntity, immediate = false) {
    return this.unitCommands.sendToHunt(target, immediate)
  }

  sendToBuilding(target: BuildingEntity, preserveBuildQueue = false) {
    return this.unitCommands.sendToBuilding(target, preserveBuildQueue)
  }

  sendToBuildingQueue(targets: BuildingEntity[]) {
    return this.unitCommands.sendToBuildingQueue(targets)
  }

  continueBuildingQueue() {
    return this.unitCommands.continueBuildingQueue()
  }

  sendToFarm(target: RuntimeEntity, immediate = false) {
    return this.unitCommands.sendToFarm(target, immediate)
  }

  sendToTree(target: RuntimeEntity, immediate = false) {
    return this.unitCommands.sendToTree(target, immediate)
  }

  sendToBerrybush(target: RuntimeEntity, immediate = false) {
    return this.unitCommands.sendToBerrybush(target, immediate)
  }

  sendToStone(target: RuntimeEntity, immediate = false) {
    return this.unitCommands.sendToStone(target, immediate)
  }

  sendToGold(target: RuntimeEntity, immediate = false) {
    return this.unitCommands.sendToGold(target, immediate)
  }

  setDefaultInterface(element: HTMLElement, data: UnitConfig) {
    this.unitInterface.setDefaultInterface(element, data)
  }

  override destroy(options?: Parameters<Instance['destroy']>[0]): void {
    this.visualSettingsCleanup?.()
    this.visualSettingsCleanup = null
    super.destroy(options)
  }
}
