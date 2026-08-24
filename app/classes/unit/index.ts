import { Assets, AnimatedSprite, type Graphics } from 'pixi.js'
import type { Texture } from 'pixi.js'
import {
  STEP_TIME,
  WORK_TYPES,
  FAMILY_TYPES,
  RELIEF_LIFT_SMOOTHING,
  SHEET_TYPES,
  LABEL_TYPES,
  MOUNTED_HORSE_SPEED_BONUS,
  SOUND_CUES,
  UNIT_TYPES,
} from '../../constants'
import {
  cartesianToIsometric,
  getInstanceZIndex,
  getGroundReliefLevel,
  getReliefLiftPixels,
  changeSpriteTexturesColorDirectly,
  throttle,
  canUpdateMinimap,
  getWorkWithLoadingType,
  bindAnimatedSpriteToTicker,
  updateInstanceVisibility,
  getAnimationFrames,
  playSoundCue,
  getIconPath,
  setSpriteFiltersPreservingDamageFeedback,
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
import { refreshUnitEquipmentStats } from '../../lib/equipmentStats'
import { getUnitWorkActionSheet } from '../../lib/unitWorkAppearance'
import { ensureUnitEnergy, resumeEnergyWaitIfReady, updateUnitEnergy } from '../../lib/unitEnergy'
import { ensureUnitHealthRegen, updateUnitHealthRegen } from '../../lib/unitHealth'
import { syncHeroResourceLoadState } from '../../lib/resourceCarry'
import { getShadowsEnabled, onVisualSettingsChange } from '../../lib/settings'
import { getHorseColorFromSeed, isHorseColor, type HorseColor } from '../../lib/horseColors'
import { heroCanCommand } from '../../lib/chief'
import { watchBanditStep } from './UnitBanditDebug'
import { syncUnitAppearanceLayers } from './UnitAppearanceLayers'
import { handleUnitIsAttacked, stopUnit } from './UnitStateHandlers'
import {
  clearMountedRiderMask as clearMountedRiderMaskVisual,
  getMountedHorseBob as getMountedHorseBobVisual,
  getMountedRiderBodyTopLeft as getMountedRiderBodyTopLeftVisual,
  getMountedRiderX as getMountedRiderXVisual,
  getMountedRiderY as getMountedRiderYVisual,
  removeMountedHorseSprite as removeMountedHorseSpriteVisual,
  removeMountedRiderLegsSprite as removeMountedRiderLegsSpriteVisual,
  setupMountedHorseSprite as setupMountedHorseSpriteVisual,
  setupMountedRiderLegsSprite as setupMountedRiderLegsSpriteVisual,
  shouldUseMountedRiderCut as shouldUseMountedRiderCutVisual,
  syncMountedHorseSprite as syncMountedHorseSpriteVisual,
  syncMountedRiderLegsSprite as syncMountedRiderLegsSpriteVisual,
  syncMountedRiderPosition as syncMountedRiderPositionVisual,
  updateMountedRiderMask as updateMountedRiderMaskVisual,
} from './UnitMountedVisuals'
import type {
  BuildingEntity,
  EntityInfoRenderOptions,
  RuntimeEntity,
  UnitCommandOptions,
  UnitCreationExtra,
  UnitEntity,
} from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { GameContextLike } from '../../types/context'
import type { PlayerLike, UnitRestoreReferences } from '../../types/player'
import type { SpritesheetLike } from '../../types/pixi'
import type { UnitConfig } from '../../types/config'
import type { ActionProps } from '../../lib/combat'

type PositionedConfig = { x?: number; y?: number; z?: number | null }

const MAIN_SPRITE_LAYER_Z_INDEX = 10
const SHADOW_MASK_ALPHA = 1
const SHADOW_SCALE_X = 1.05
const SHADOW_SCALE_Y = -0.42

function getCachedSpritesheet(id: string): SpritesheetLike | undefined {
  return Assets.cache.has(id) ? (Assets.cache.get(id) as SpritesheetLike | undefined) : undefined
}

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
          /^lpc\/(?:villager|infantry)\/body\//.test(asset) && Assets.cache.has(`${asset}/${variants.skin}`)
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
      /^lpc\/(?:villager|infantry)\/body\//.test(asset) && Assets.cache.has(`${asset}/${variants.skin}`)
        ? `${asset}/${variants.skin}`
        : asset,
    ])
  )
}

export type UnitSpawnOptions = Omit<Partial<UnitEntity>, keyof UnitRestoreReferences> &
  UnitRestoreReferences & { i: number; j: number; type: string; owner?: PlayerLike; suppressCreateSound?: boolean }

function isEntityDestination(dest: RuntimeEntity | RuntimeCell | null | undefined): dest is RuntimeEntity {
  return Boolean(dest && 'label' in dest)
}

function isDestroyedDestination(dest: RuntimeEntity | RuntimeCell | null | undefined): boolean {
  return isEntityDestination(dest) && Boolean(dest.isDestroyed)
}

export class Unit extends Instance implements UnitEntity {
  unitInterface!: UnitInterface
  unitCommands!: UnitCommands
  unitLifecycle!: UnitLifecycle
  unitCombat!: UnitCombat
  unitActions!: UnitActions
  unitMovement!: UnitMovement
  sendTo!: (target: RuntimeCell | RuntimeEntity, action?: string) => void

  declare sprite: AnimatedSprite
  shadow!: AnimatedSprite | null
  horseSprite!: AnimatedSprite | null
  horseShadow!: AnimatedSprite | null
  mountedRiderLegsSprite!: AnimatedSprite | null
  mountedRiderMask!: Graphics | null
  appearanceLayerSprites!: Map<number, AnimatedSprite>
  declare reliefLift: number
  sheetDirectionCounts?: Record<string, number>
  sheetDirectionOrders?: Record<string, string[]>
  spriteScale?: number
  controlMode!: NonNullable<UnitEntity['controlMode']>
  inactif!: boolean
  sounds?: UnitEntity['sounds']
  work: UnitEntity['work']
  shelterState?: UnitEntity['shelterState']
  loading!: UnitEntity['loading']
  loadingType: UnitEntity['loadingType']
  resourceLoads: UnitEntity['resourceLoads']

  dest: UnitEntity['dest']
  realDest: UnitEntity['realDest']
  previousDest: UnitEntity['previousDest']
  previousWork: UnitEntity['previousWork']
  path!: NonNullable<UnitEntity['path']>
  pendingOrder: UnitEntity['pendingOrder']
  blockedGatherApproach: UnitEntity['blockedGatherApproach']
  buildQueue!: NonNullable<UnitEntity['buildQueue']>
  isDirectMoving?: UnitEntity['isDirectMoving']
  currentCell!: NonNullable<UnitEntity['currentCell']>
  visibleCells!: NonNullable<UnitEntity['visibleCells']>
  speed?: UnitEntity['speed']

  actionLocked!: boolean
  contextAction?: UnitEntity['contextAction']
  currentSheet!: NonNullable<UnitEntity['currentSheet']>
  currentFrame!: NonNullable<UnitEntity['currentFrame']>
  mountedOnHorse?: UnitEntity['mountedOnHorse']
  horseColor?: HorseColor
  actionSheet?: UnitEntity['actionSheet']
  walkingSheet?: UnitEntity['walkingSheet']
  standingSheet?: UnitEntity['standingSheet']
  loop?: UnitEntity['loop']
  visibilityTimeout?: UnitEntity['visibilityTimeout']
  showLoading?: UnitEntity['showLoading']
  showBuildings?: UnitEntity['showBuildings']
  visualSettingsCleanup!: (() => void) | null

  assets?: UnitEntity['assets']
  allAssets?: UnitEntity['allAssets']
  declare energy?: UnitEntity['energy']
  declare totalEnergy?: UnitEntity['totalEnergy']
  energyRegenRate?: UnitEntity['energyRegenRate']
  energyRegenDelay?: UnitEntity['energyRegenDelay']
  energyRegenMultiplier?: UnitEntity['energyRegenMultiplier']
  lastEnergySpentAt?: UnitEntity['lastEnergySpentAt']
  energyCosts?: UnitEntity['energyCosts']
  waitingForEnergyAction?: UnitEntity['waitingForEnergyAction']
  waitingForEnergyTarget?: UnitEntity['waitingForEnergyTarget']
  energyWaitTaskId?: UnitEntity['energyWaitTaskId']
  attackRecoveryMs?: UnitEntity['attackRecoveryMs']
  attackRecoveryTaskId?: UnitEntity['attackRecoveryTaskId']
  attackRecoveryAnimationTaskId?: UnitEntity['attackRecoveryAnimationTaskId']
  combatBehavior?: UnitEntity['combatBehavior']
  combatBehaviorPreset?: UnitEntity['combatBehaviorPreset']
  combatMode?: UnitEntity['combatMode']
  combatRecoveryOrbitDirection?: UnitEntity['combatRecoveryOrbitDirection']
  lastCombatRecoveryMoveAt?: UnitEntity['lastCombatRecoveryMoveAt']
  contextActionEnergyCosts?: UnitEntity['contextActionEnergyCosts']
  toolLevels?: UnitEntity['toolLevels']
  inventory?: UnitEntity['inventory']
  lootEquipment?: UnitEntity['lootEquipment']
  appearance?: UnitEntity['appearance']
  appearanceVariants?: UnitEntity['appearanceVariants']

  totalQuantity?: UnitEntity['totalQuantity']
  quantity!: number
  experience!: NonNullable<UnitEntity['experience']>
  isChief?: UnitEntity['isChief']

  interface!: UnitEntity['interface']
  handleSetDest?: UnitEntity['handleSetDest']
  handleIsAttacked?: UnitEntity['handleIsAttacked']

  constructor(options: UnitSpawnOptions, context: GameContextLike) {
    super(context)
    this.sortableChildren = true
    this.selectionFactor = 0.5

    this.initializeServices()
    this.initializeRuntimeState()
    const spawnCell = this.applySpawnConfiguration(options)
    this.registerInitialMapPresence()
    this.initializeWorkRole()
    this.loadConfiguredSpritesheets()
    this.playCreateSound(options)
    this.setupInterface()
    this.setupPrimarySprite(spawnCell)
    this.setupCommandDispatch()
    this.setupPointerInteraction()
    this.visibilityTimeout = setTimeout(() => {
      if (!this.isDestroyed) updateInstanceVisibility(this)
    })
  }

  initializeServices(): void {
    this.family = FAMILY_TYPES.unit
    this.unitInterface = new UnitInterface(this)
    this.unitCommands = new UnitCommands(this)
    this.unitLifecycle = new UnitLifecycle(this)
    this.unitCombat = new UnitCombat(this)
    this.unitActions = new UnitActions(this)
    this.unitMovement = new UnitMovement(this)
    this.shadow = null
    this.horseSprite = null
    this.horseShadow = null
    this.mountedRiderLegsSprite = null
    this.mountedRiderMask = null
    this.visualSettingsCleanup = null
    this.appearanceLayerSprites = new Map()
    this.reliefLift = 0
  }

  initializeRuntimeState(): void {
    const { map } = this.context
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
    this.controlMode = 'standard'
    this.actionLocked = false
    this.pendingOrder = null
    this.loading = 0
    this.loadingType = null
    this.currentSheet = SHEET_TYPES.standing
    this.inactif = true
    this.experience = {}
  }

  applySpawnConfiguration(options: UnitSpawnOptions): RuntimeCell {
    const { map } = this.context
    this.assignProperties(options)
    const unitConfig = this.owner.config.units[this.type] as (typeof this.owner.config.units)[string] & PositionedConfig
    this.assignProperties(unitConfig)
    this.mountedOnHorse = options.mountedOnHorse ?? this.mountedOnHorse
    if (this.mountedOnHorse) {
      this.horseColor = isHorseColor(options.horseColor)
        ? options.horseColor
        : isHorseColor(this.horseColor)
          ? this.horseColor
          : getHorseColorFromSeed(`${this.owner?.label}:${this.type}:${this.i}:${this.j}:${this.label}`)
    }
    this.hitPoints = options.hitPoints ?? this.hitPoints
    this.speed = options.speed ?? this.speed
    if (this.mountedOnHorse && options.speed == null) this.speed = (this.speed ?? 0) + MOUNTED_HORSE_SPEED_BONUS
    syncHeroResourceLoadState(this)
    this.experience = options.experience ? { ...options.experience } : this.experience
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
    ensureUnitEnergy(this)
    ensureUnitHealthRegen(this)
    return spawnCell
  }

  registerInitialMapPresence(): void {
    const { map } = this.context
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
  }

  initializeWorkRole(): void {
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
    refreshUnitEquipmentStats(this)
  }

  loadConfiguredSpritesheets(): void {
    const assets = this.assets ?? this.allAssets?.default
    if (!assets) return
    for (const [key, value] of Object.entries(assets)) {
      Object.assign(this, { [key]: getCachedSpritesheet(value) })
    }
  }

  playCreateSound(options: UnitSpawnOptions): void {
    if (
      !options.suppressCreateSound &&
      this.owner.isPlayed &&
      this.context.map.ready &&
      this.context.controls.instanceIsAudible?.(this)
    ) {
      playSoundCue((this.sounds && this.sounds.create) || SOUND_CUES.unit.fallbackCreate)
    }
  }

  setupInterface(): void {
    const { menu } = this.context
    this.interface = {
      info: (element: HTMLElement, options?: EntityInfoRenderOptions) => {
        const data = this.owner.config.units[this.type]
        this.setDefaultInterface(element, data, options)
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
                        meta: heroCanCommand(this.context.controls.heroUnit) ? [] : [t('requiresChief')],
                      }),
                      disabled: () => !heroCanCommand(this.context.controls.heroUnit),
                      children: Object.keys(this.owner.config.buildings)
                        .map(key => menu.getActionBuildingButton?.(key, this.owner))
                        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
                    },
                  ]
                : []),
            ]
          : [],
    }
  }

  setupPrimarySprite(spawnCell: RuntimeCell): void {
    this.eventMode = 'static'
    this.actionSheet = this.actionSheet || getUnitWorkActionSheet(this, this.work, this.action)
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
    this.context.map.shadowLayer?.addChild(this.shadow)
    this.addChild(this.sprite)
    this.setupMountedHorseSprite()
    this.visualSettingsCleanup = onVisualSettingsChange(() => this.syncVisualSettings())
    if (this.isDead) {
      this.currentSheet === SHEET_TYPES.corpse ? this.decompose() : this.death()
    } else if ((this.loading ?? 0) > 0) {
      const loadingWork = getWorkWithLoadingType(this.loadingType ?? '')
      const loadedSheetId = this.allAssets?.[loadingWork]?.loadedSheet
      const standingSheetId = this.allAssets?.[loadingWork]?.standingSheet
      this.walkingSheet = loadedSheetId ? getCachedSpritesheet(loadedSheetId) : undefined
      this.standingSheet = standingSheetId ? getCachedSpritesheet(standingSheetId) : undefined
    }
    this.setTextures(this.currentSheet)

    this.sprite.currentFrame = Math.min(this.currentFrame, this.sprite.textures.length - 1)
    this.syncShadow()
    this.syncAppearanceLayers(this.currentSheet)
    this.applyReliefLift(getGroundReliefLevel(spawnCell), true)
    this.sprite.updateAnchor = true
    if (this.shouldKeepHealthBarVisible()) {
      this.drawHealthBar()
      this.drawEnergyBar()
    }
  }

  setupCommandDispatch(): void {
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
  }

  setupPointerInteraction(): void {
    this.on('pointerup', () => {
      const {
        context: { controls, editor },
      } = this
      if (editor?.handleEntityInteraction?.(this)) return
      if (controls.rallyPointController?.active) {
        controls.mouse.prevent = true
        controls.rallyPointController.handleMouseUpOnEntity(this)
      }
    })
  }

  createShadow(source: AnimatedSprite = this.sprite, label: string = LABEL_TYPES.shadow) {
    const shadow = new AnimatedSprite(source.textures as Texture[])
    bindAnimatedSpriteToTicker(shadow, this.context.app)
    shadow.label = label
    shadow.eventMode = 'none'
    shadow.roundPixels = true
    shadow.tint = 0x000000
    shadow.alpha = SHADOW_MASK_ALPHA
    shadow.zIndex = -2
    this.syncShadow(shadow, source)
    return shadow
  }

  syncShadow(shadow = this.shadow, source: AnimatedSprite | null = this.sprite) {
    if (!shadow || !source) return
    const frame = Math.min(source.currentFrame, Math.max(source.textures.length - 1, 0))
    shadow.visible = getShadowsEnabled() && this.visible && !this.isDestroyed
    shadow.textures = source.textures
    shadow.animationSpeed = source.animationSpeed
    shadow.loop = source.loop
    shadow.anchor.set(source.anchor.x, source.anchor.y)
    shadow.alpha = SHADOW_MASK_ALPHA
    shadow.rotation = 0
    shadow.scale.x = source.scale.x * SHADOW_SCALE_X
    shadow.scale.y = Math.abs(source.scale.y) * SHADOW_SCALE_Y
    // The shadow rises/sinks with the sprite on relief (both stand on the same raised
    // ground) — unlike a flying animal's shadow, which stays pinned to the ground.
    shadow.position.set(this.x + source.position.x, this.y + (this.reliefLift ?? 0))
    if (source.playing) {
      shadow.gotoAndPlay(frame)
    } else {
      shadow.gotoAndStop(frame)
    }
  }

  getMountedHorseBob(): number {
    return getMountedHorseBobVisual(this)
  }

  getMountedRiderY(): number {
    return getMountedRiderYVisual(this)
  }

  getMountedRiderX(): number {
    return getMountedRiderXVisual(this)
  }

  setupMountedHorseSprite() {
    setupMountedHorseSpriteVisual(this, getCachedSpritesheet)
  }

  setupMountedRiderLegsSprite() {
    setupMountedRiderLegsSpriteVisual(this, getCachedSpritesheet)
  }

  syncMountedRiderPosition() {
    syncMountedRiderPositionVisual(this, getCachedSpritesheet)
  }

  shouldUseMountedRiderCut(sheet = this.currentSheet): boolean {
    return shouldUseMountedRiderCutVisual(this, sheet)
  }

  updateMountedRiderMask(sheet = this.currentSheet) {
    updateMountedRiderMaskVisual(this, sheet)
  }

  clearMountedRiderMask() {
    clearMountedRiderMaskVisual(this)
  }

  getMountedRiderBodyTopLeft(): { x: number; y: number; width: number; scale: number } {
    return getMountedRiderBodyTopLeftVisual(this)
  }

  syncMountedRiderLegsSprite() {
    syncMountedRiderLegsSpriteVisual(this, getCachedSpritesheet)
  }

  removeMountedRiderLegsSprite() {
    removeMountedRiderLegsSpriteVisual(this)
  }

  syncMountedHorseSprite() {
    syncMountedHorseSpriteVisual(this, getCachedSpritesheet)
  }

  removeMountedHorseSprite() {
    removeMountedHorseSpriteVisual(this)
  }

  syncVisualSettings(): void {
    if (this.shadow) {
      this.shadow.visible = getShadowsEnabled() && this.visible && !this.isDestroyed
    }
    if (this.horseShadow) {
      this.horseShadow.visible = getShadowsEnabled() && this.visible && !this.isDestroyed
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
    this.syncMountedRiderPosition()
    if (this.horseSprite) this.horseSprite.position.y = this.reliefLift
    this.syncShadow()
    this.syncShadow(this.horseShadow, this.horseSprite)
    this.syncSelectionMarkersToRelief()
    const healthBar = this.getChildByLabel(LABEL_TYPES.healthBar)
    if (healthBar) healthBar.position.y = this.getMountedRiderY()
    const powerBar = this.getChildByLabel(LABEL_TYPES.powerBar)
    if (powerBar) powerBar.position.y = this.getMountedRiderY()
    const energyBar = this.getChildByLabel(LABEL_TYPES.energyBar)
    if (energyBar) energyBar.position.y = this.getMountedRiderY()
  }

  syncAppearanceLayers(sheet: string) {
    syncUnitAppearanceLayers(this, sheet)
  }

  override setTextures(sheet: string) {
    super.setTextures(sheet)
    this.applyOwnerColorToSprite()
    this.syncShadow()
    this.syncMountedHorseSprite()
    this.syncAppearanceLayers(sheet)
    this.updateMountedRiderMask(sheet)
  }

  applyOwnerColorToSprite() {
    if (!this.sprite?.textures?.length) return

    const frame = this.sprite.currentFrame
    const playing = this.sprite.playing
    const textures = changeSpriteTexturesColorDirectly(this.sprite.textures as Texture[], this.owner.color ?? '')
    setSpriteFiltersPreservingDamageFeedback(this.sprite, null)
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
    this.horseSprite?.stop()
    this.horseShadow?.stop()
    for (const sprite of this.appearanceLayerSprites.values()) {
      sprite.stop()
    }
  }

  override resume() {
    if (this.currentSheet === SHEET_TYPES.standing) {
      this.sprite.gotoAndStop(this.sprite.currentFrame)
      this.shadow?.gotoAndStop(this.shadow.currentFrame)
      this.horseSprite?.play()
      this.horseShadow?.gotoAndStop(this.horseShadow.currentFrame)
      for (const sprite of this.appearanceLayerSprites.values()) {
        sprite.gotoAndStop(sprite.currentFrame)
      }
      return
    }
    super.resume()
    this.shadow?.play()
    this.horseSprite?.play()
    this.horseShadow?.play()
    for (const sprite of this.appearanceLayerSprites.values()) {
      sprite.play()
    }
  }

  override select() {
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
    this.sprite.loop = this.loop ?? true
    if (this.shadow) this.shadow.loop = this.sprite.loop
    for (const sprite of this.appearanceLayerSprites.values()) {
      sprite.loop = this.loop ?? true
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
    if (dest && 'cancelTrainingForUnit' in dest) {
      dest.cancelTrainingForUnit?.(this)
    }
    if (dest && 'isUsedBy' in dest && dest.isUsedBy === this) {
      dest.isUsedBy = null
    }
  }

  sendToEvt(
    dest: RuntimeEntity | RuntimeCell | null,
    action?: string | null,
    options?: { forceRepath?: boolean; allowBlockedGatherApproach?: boolean; preserveAutonomy?: boolean }
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

  override getActionCondition(
    target: object | null | undefined,
    action = this.action ?? undefined,
    props?: ActionProps | UnitCreationExtra
  ) {
    return this.unitCommands.getActionCondition(target, action, props)
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

  override step(): void {
    const beforeX = this.x
    const beforeY = this.y
    updateUnitEnergy(this)
    updateUnitHealthRegen(this)
    if (resumeEnergyWaitIfReady(this)) {
      watchBanditStep(this, beforeX, beforeY)
      return
    }
    super.step()
    watchBanditStep(this, beforeX, beforeY)
  }

  moveDirect(
    dirX: number,
    dirY: number,
    distance: number,
    options?: { facingDirX?: number; facingDirY?: number }
  ): boolean {
    return this.unitMovement.moveDirect(dirX, dirY, distance, options)
  }

  isAttacked(instance: RuntimeEntity | null) {
    return handleUnitIsAttacked(this, instance)
  }

  stop() {
    return stopUnit(this)
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

  sendToCaptureHorse(target: RuntimeEntity, immediate = false) {
    return this.unitCommands.sendToCaptureHorse(target, immediate)
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

  setDefaultInterface(element: HTMLElement, data: UnitConfig, options?: EntityInfoRenderOptions) {
    this.unitInterface.setDefaultInterface(element, data, options)
  }

  override destroy(options?: Parameters<Instance['destroy']>[0]): void {
    this.visualSettingsCleanup?.()
    this.visualSettingsCleanup = null
    this.shadow?.parent?.removeChild(this.shadow)
    this.shadow?.destroy({ children: true, texture: false })
    this.shadow = null
    this.removeMountedHorseSprite()
    super.destroy(options)
  }
}
