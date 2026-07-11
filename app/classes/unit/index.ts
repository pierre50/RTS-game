import { Assets, AnimatedSprite } from 'pixi.js'
import type { Texture } from 'pixi.js'
import {
  STEP_TIME,
  MAX_SELECT_UNITS,
  WORK_TYPES,
  ACTION_TYPES,
  FAMILY_TYPES,
  SHEET_TYPES,
  LABEL_TYPES,
  SOUND_CUES,
  UNIT_TYPES,
} from '../../constants'
import {
  getInstanceZIndex,
  changeSpriteColor,
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
} from '../../lib'
import { Instance } from '../Instance'
import { UnitInterface } from '../../ui/UnitInterface'
import { UnitCommands } from './UnitCommands'
import { UnitLifecycle } from './UnitLifecycle'
import { UnitCombat } from './UnitCombat'
import { UnitActions } from './UnitActions'
import { UnitMovement } from './UnitMovement'
import { t } from '../../lib/lang'
import type { BuildingEntity, RuntimeEntity, UnitCommandOptions, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { GameContextLike } from '../../types/context'
import type { PlayerLike } from '../../types/player'
import type { AssetAge, SpritesheetLike } from '../../types/pixi'
import type { UnitConfig } from '../../types/config'
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
  loadedInTransport: UnitEntity['loadedInTransport']
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

  assets?: UnitEntity['assets']
  allAssets?: UnitEntity['allAssets']

  totalQuantity?: UnitEntity['totalQuantity']
  quantity!: number

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
    this.actionLocked = false
    this.pendingOrder = null
    this.loading = 0
    this.loadingType = null
    this.currentSheet = SHEET_TYPES.standing
    this.inactif = true
    Object.assign(this, options)
    const unitConfig = this.owner.config.units[this.type] as (typeof this.owner.config.units)[string] & PositionedConfig
    Object.assign(this, unitConfig)
    this.size = 1
    this.visible = false
    this.visibleCells = new Set()
    const spawnCell = map.grid[this.i][this.j]
    this.x = unitConfig.x ?? options.x ?? spawnCell.x
    this.y = unitConfig.y ?? options.y ?? spawnCell.y
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
                      icon: 'assets/interface/50721/002_50721.png',
                      tooltip: () => ({
                        title: t('buildMenu'),
                        description: t('buildMenuDescription'),
                      }),
                      children: Object.keys(this.owner.config.buildings)
                        .map(key => menu.getBuildingButton?.(key, this.owner))
                        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
                    },
                  ]
                : []),
              ...(this.transportCapacity
                ? [
                    {
                      id: 'unload',
                      icon: 'assets/interface/50721/001_50721.png',
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
    if (this.isDead) {
      this.currentSheet === SHEET_TYPES.corpse ? this.decompose() : this.death()
    } else if ((this.loading ?? 0) > 0) {
      const loadingWork = getWorkWithLoadingType(this.loadingType ?? '')
      this.walkingSheet = this.allAssets?.[loadingWork] && Assets.cache.get(this.allAssets[loadingWork].loadedSheet)
      this.standingSheet = this.allAssets?.[loadingWork] && Assets.cache.get(this.allAssets[loadingWork].standingSheet)
    }
    this.setTextures(this.currentSheet)

    this.sprite.currentFrame = Math.min(this.currentFrame, this.sprite.textures.length - 1)
    this.sprite.updateAnchor = true
    this.addChild(this.sprite)
    this.setupSailSprite()
    this.syncFishingOverlaySprite()

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
            if (
              playerUnit.work === WORK_TYPES.healer &&
              playerUnit.getActionCondition?.(this, ACTION_TYPES.heal)
            ) {
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
            if (
              playerUnit.work === WORK_TYPES.healer &&
              playerUnit.getActionCondition?.(this, ACTION_TYPES.convert)
            ) {
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
        } else if (
          (player.selectedOther !== this && playerCanSeeInstance(this, player)) ||
          map.revealEverything
        ) {
          player.unselectAll()
          this.select()
          menu.setBottombar(this)
          player.selectedOther = this
          playSelectionSound(this)
        }
      }
    })

    changeSpriteColor(this.sprite!, this.owner.color ?? '')

    this.visibilityTimeout = setTimeout(() => {
      if (!this.isDestroyed) updateInstanceVisibility(this)
    })
  }

  setupSailSprite() {
    if (!this.sailSpritesheet?.textures) return

    const { textures, mirrored } = getSailAnimationFrames(
      this.sailSpritesheet.textures,
      this
    )
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

    const { textures, mirrored } = getSailAnimationFrames(
      this.sailSpritesheet.textures,
      this
    )
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

  override setTextures(sheet: string) {
    super.setTextures(sheet)
    this.syncSailSprite(this.sailSprite?.currentFrame)
    this.syncFishingOverlaySprite()
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

  isAttacked(instance: RuntimeEntity | null) {
    if (this.context.editor) {
      return
    }
    if (!instance || this.isDead) {
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
    if (this.currentCell.has?.label !== this.label && this.currentCell.solid) {
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
    this.currentCell.place(this)
    this.currentCell.solid = true
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
}
