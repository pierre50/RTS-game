import { Assets, AnimatedSprite, Graphics } from 'pixi.js'
import type { Texture } from 'pixi.js'
import {
  STEP_TIME,
  WORK_TYPES,
  ACTION_TYPES,
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
  changeSpriteColor,
  throttle,
  canUpdateMinimap,
  getWorkWithLoadingType,
  bindAnimatedSpriteToTicker,
  updateInstanceVisibility,
  degreeToDirection,
  getInstanceDegree,
  getAnimationFrames,
  playSoundCue,
  evaluateCombatMorale,
  getIconPath,
  getSpriteFrameSelection,
  setSpriteFiltersPreservingDamageFeedback,
  showAggressionFeedback,
  updateInstanceRenderVisibility,
  resumeVillagerAutonomy,
} from '../../lib'
import { clearCombatAttackRecovery } from '../../lib/combatAttackLoop'
import { applyBakedLpcUnitAssets, resolveLpcAppearanceVariants } from '../../lib/lpc'
import { isAppearanceLayerHiddenByLoading } from '../../lib/lpc/appearanceLayers'
import { civilizationKey } from '../../lib/lpc/equipment'
import { getUnitEquipmentLevel } from '../../lib/unitExperience'
import { Instance } from '../Instance'
import { UnitInterface } from '../../ui/UnitInterface'
import { UnitCommands } from './UnitCommands'
import { UnitLifecycle } from './UnitLifecycle'
import { UnitCombat } from './UnitCombat'
import { UnitActions } from './UnitActions'
import { UnitMovement } from './UnitMovement'
import { t } from '../../lib/lang'
import { applyToolAppearance } from '../../lib/heroTools'
import { refreshUnitEquipmentStats } from '../../lib/equipmentStats'
import { getUnitWorkActionSheet } from '../../lib/unitWorkAppearance'
import { ensureUnitEnergy, resumeEnergyWaitIfReady, updateUnitEnergy } from '../../lib/unitEnergy'
import { ensureUnitHealthRegen, markUnitHealthDamaged, updateUnitHealthRegen } from '../../lib/unitHealth'
import { shouldSuppressAggroDuringCombatRecovery } from '../../lib/combatBehavior'
import { syncHeroResourceLoadState } from '../../lib/resourceCarry'
import { getShadowsEnabled, onVisualSettingsChange } from '../../lib/settings'
import { getHorseColorFromSeed, isHorseColor, recolorHorseTextures, type HorseColor } from '../../lib/horseColors'
import { canAutoReactToAttack, isHeroControlled } from '../../lib/unitControl'
import { heroCanCommand } from '../../lib/chief'
import {
  MOUNTED_HORSE_BOB,
  MOUNTED_RIDER_CUT_Y,
  MOUNTED_RIDER_LEGS_SHEET,
  MOUNTED_RIDER_Y_OFFSET,
  mountedRiderBaseDirection,
  mountedRiderLegOffset,
  mountedRiderXOffset,
} from '../../lib/mountedRider'
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
import type { PlayerLike } from '../../types/player'
import type { AssetAge, SpritesheetLike } from '../../types/pixi'
import type { UnitAppearanceLayerConfig, UnitConfig } from '../../types/config'
import type { SaveDestination, SaveGridPoint, SaveReference } from '../../types/save'
import type { ActionProps } from '../../lib/combat'

type UnitRestoreReferences = {
  assetAge?: AssetAge
  dest?: RuntimeEntity | RuntimeCell | SaveReference | SaveDestination | null
  previousDest?: RuntimeEntity | RuntimeCell | SaveReference | SaveDestination | null
  realDest?: UnitEntity['realDest'] | SaveDestination | null
  path?: RuntimeCell[] | SaveGridPoint[]
  buildQueue?: BuildingEntity[] | string[]
  blockedGatherApproach?: UnitEntity['blockedGatherApproach'] | { target: SaveReference; action: string } | null
}

type PositionedConfig = { x?: number; y?: number; z?: number | null }

type RuntimeAppearanceLayer = UnitAppearanceLayerConfig & {
  sprite?: AnimatedSprite
}
const MAIN_SPRITE_LAYER_Z_INDEX = 10
// Equipment layers sit at zIndex 8 (back) / 12 (front, see EQUIPMENT_LAYER_Z_INDEX in lpc/equipment.ts).
// "Behind" keeps the horse under the back layer; "front" clears the front layer too, so the horse
// covers the rider's whole stack (body + weapon) for south-facing directions.
const MOUNTED_HORSE_BEHIND_Z_INDEX = 0
const MOUNTED_HORSE_FRONT_Z_INDEX = 13
const MOUNTED_HORSE_STANDING_SHEET = 'animals/horse/standing'
const MOUNTED_HORSE_WALKING_SHEET = 'animals/horse/walking'
const MOUNTED_HORSE_DIRECTIONS_IN_FRONT = new Set(['south', 'southwest', 'southeast'])
const SHADOW_MASK_ALPHA = 1
const SHADOW_SCALE_X = 1.05
const SHADOW_SCALE_Y = -0.42
const BANDIT_STOP_DEBUG_THROTTLE_MS = 600
let lastBanditStopDebugAt = 0
const banditStepDebugState = new WeakMap<
  UnitEntity,
  { stillTicks: number; x: number; y: number; lastReason?: string }
>()

function isBanditDebugUnit(unit: UnitEntity): boolean {
  const owner = unit.owner as (PlayerLike & { devConsoleBanditOwner?: boolean }) | undefined
  const type = unit.type?.toLowerCase() ?? ''
  const name = unit.name?.toLowerCase() ?? ''
  const category = unit.category?.toLowerCase() ?? ''
  const ownerName = owner?.name?.toLowerCase() ?? ''
  const ownerLabel = owner?.label?.toLowerCase() ?? ''
  return Boolean(
    category.includes('bandit') ||
      type.includes('bandit') ||
      name.includes('bandit') ||
      ownerName.includes('bandit') ||
      ownerLabel.includes('bandit') ||
      (typeof UNIT_TYPES.banditChief === 'string' && unit.type === UNIT_TYPES.banditChief) ||
      (typeof UNIT_TYPES.banditSword === 'string' && unit.type === UNIT_TYPES.banditSword) ||
      (typeof UNIT_TYPES.banditArcher === 'string' && unit.type === UNIT_TYPES.banditArcher) ||
      owner?.devConsoleBanditOwner ||
      (owner?.isPlayed !== true && owner?.name?.trim().toLowerCase() === 'bandits')
  )
}

function debugBanditStop(unit: UnitEntity, reason: string): void {
  if (!isBanditDebugUnit(unit)) return
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  if (now - lastBanditStopDebugAt < BANDIT_STOP_DEBUG_THROTTLE_MS) return
  lastBanditStopDebugAt = now
  const cell = unit.currentCell
  const occupant = cell?.has
  console.warn('[bandit-move]', reason, {
    unit: {
      label: unit.label,
      type: unit.type,
      action: unit.action,
      combatMode: unit.combatMode,
      currentSheet: unit.currentSheet,
      spritePlaying: unit.sprite?.playing,
      i: unit.i,
      j: unit.j,
      pathLength: unit.path?.length ?? 0,
    },
    currentCell: cell
      ? {
          i: cell.i,
          j: cell.j,
          solid: cell.solid,
          has: occupant
            ? {
                label: occupant.label,
                type: occupant.type,
                family: occupant.family,
                isDead: occupant.isDead,
                isDestroyed: occupant.isDestroyed,
                sameLabel: occupant.label === unit.label,
                sameObject: occupant === unit,
              }
            : null,
        }
      : null,
  })
}

function debugBanditStep(unit: UnitEntity, reason: string): void {
  if (!isBanditDebugUnit(unit)) return
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  if (now - lastBanditStopDebugAt < BANDIT_STOP_DEBUG_THROTTLE_MS) return
  lastBanditStopDebugAt = now
  const cell = unit.currentCell
  const next = unit.path?.at(-1)
  const nextCell = next ? unit.context?.map?.grid[next.i]?.[next.j] : null
  console.warn('[bandit-stuck]', reason, {
    unit: {
      label: unit.label,
      type: unit.type,
      name: unit.name,
      category: unit.category,
      owner: unit.owner?.label,
      ownerName: unit.owner?.name,
      action: unit.action,
      work: unit.work,
      combatMode: unit.combatMode,
      currentSheet: unit.currentSheet,
      spritePlaying: unit.sprite?.playing,
      inactif: unit.inactif,
      interval: (unit as { interval?: unknown }).interval,
      i: unit.i,
      j: unit.j,
      x: Math.round((unit.x ?? 0) * 100) / 100,
      y: Math.round((unit.y ?? 0) * 100) / 100,
      pathLength: unit.path?.length ?? 0,
    },
    currentCell: cell
      ? {
          i: cell.i,
          j: cell.j,
          solid: cell.solid,
          has: cell.has
            ? {
                label: cell.has.label,
                type: cell.has.type,
                family: cell.has.family,
                sameLabel: cell.has.label === unit.label,
                sameObject: cell.has === unit,
              }
            : null,
        }
      : null,
    nextCell: nextCell
      ? {
          i: nextCell.i,
          j: nextCell.j,
          solid: nextCell.solid,
          has: nextCell.has
            ? {
                label: nextCell.has.label,
                type: nextCell.has.type,
                family: nextCell.has.family,
                sameLabel: nextCell.has.label === unit.label,
                sameObject: nextCell.has === unit,
              }
            : null,
        }
      : null,
  })
}

function watchBanditStep(unit: UnitEntity, beforeX: number, beforeY: number): void {
  if (!isBanditDebugUnit(unit)) {
    banditStepDebugState.delete(unit)
    return
  }
  const walking =
    unit.currentSheet === SHEET_TYPES.walking || Boolean(unit.sprite?.playing && (unit.path?.length ?? 0) > 0)
  if (!walking || unit.isDead || unit.isDestroyed) {
    banditStepDebugState.delete(unit)
    return
  }
  const pathLength = unit.path?.length ?? 0
  if (pathLength <= 0) {
    debugBanditStep(unit, 'walking-without-path')
    const dest = unit.dest
    if (unit.action && dest && unit.isUnitAtDest?.(unit.action, dest)) {
      unit.degree = getInstanceDegree(unit, dest.x, dest.y)
      unit.getAction?.(unit.action)
    } else {
      unit.stopInterval?.()
      unit.setTextures?.(SHEET_TYPES.standing)
      unit.sprite?.stop()
      unit.inactif = true
    }
    banditStepDebugState.delete(unit)
    return
  }
  const state = banditStepDebugState.get(unit) ?? { stillTicks: 0, x: beforeX, y: beforeY }
  const moved = Math.hypot((unit.x ?? 0) - beforeX, (unit.y ?? 0) - beforeY) > 0.01
  state.stillTicks = moved ? 0 : state.stillTicks + 1
  state.x = unit.x ?? beforeX
  state.y = unit.y ?? beforeY
  banditStepDebugState.set(unit, state)
  if (state.stillTicks >= 8) {
    debugBanditStep(unit, 'walking-no-position-progress')
    state.stillTicks = 0
  }
}

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

function getLevelSheetOverride(
  overrides: RuntimeAppearanceLayer['ageSheetOverrides'] | undefined,
  ownerAge: number,
  sheet: string
): string | undefined {
  if (!overrides) return undefined
  const exact = overrides[String(ownerAge)]?.[sheet]
  if (exact) return exact
  const fallbackAge = Object.keys(overrides)
    .map(Number)
    .filter(age => age <= ownerAge)
    .sort((a, b) => b - a)[0]
  return fallbackAge == null ? undefined : overrides[String(fallbackAge)]?.[sheet]
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
  unitInterface: UnitInterface
  unitCommands: UnitCommands
  unitLifecycle: UnitLifecycle
  unitCombat: UnitCombat
  unitActions: UnitActions
  unitMovement: UnitMovement
  sendTo!: (target: RuntimeCell | RuntimeEntity, action?: string) => void

  declare sprite: AnimatedSprite
  shadow: AnimatedSprite | null
  horseSprite: AnimatedSprite | null
  horseShadow: AnimatedSprite | null
  mountedRiderLegsSprite: AnimatedSprite | null
  mountedRiderMask: Graphics | null
  appearanceLayerSprites: Map<number, AnimatedSprite>
  declare reliefLift: number
  sheetDirectionCounts?: Record<string, number>
  sheetDirectionOrders?: Record<string, string[]>
  spriteScale?: number
  controlMode!: NonNullable<UnitEntity['controlMode']>
  inactif!: boolean
  sounds?: UnitEntity['sounds']
  work: UnitEntity['work']
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
  visualSettingsCleanup: (() => void) | null

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
    this.horseSprite = null
    this.horseShadow = null
    this.mountedRiderLegsSprite = null
    this.mountedRiderMask = null
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
    this.controlMode = 'standard'
    this.actionLocked = false
    this.pendingOrder = null
    this.loading = 0
    this.loadingType = null
    this.currentSheet = SHEET_TYPES.standing
    this.inactif = true
    this.experience = {}
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
    refreshUnitEquipmentStats(this)

    if (this.assets) {
      for (const [key, value] of Object.entries(this.assets)) {
        Object.assign(this, { [key]: getCachedSpritesheet(value) })
      }
    } else if (this.allAssets) {
      for (const [key, value] of Object.entries(this.allAssets.default)) {
        Object.assign(this, { [key]: getCachedSpritesheet(value) })
      }
    }
    if (
      !options.suppressCreateSound &&
      this.owner.isPlayed &&
      map.ready &&
      this.context.controls.instanceIsAudible?.(this)
    ) {
      playSoundCue((this.sounds && this.sounds.create) || SOUND_CUES.unit.fallbackCreate)
    }

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

    this.visibilityTimeout = setTimeout(() => {
      if (!this.isDestroyed) updateInstanceVisibility(this)
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
    if (!this.mountedOnHorse || !this.horseSprite) return 0
    const direction = degreeToDirection(this.degree) ?? 'south'
    const bobDirection = mountedRiderBaseDirection(direction)
    const bob = MOUNTED_HORSE_BOB[bobDirection]
    return bob[this.horseSprite.currentFrame % bob.length] ?? 0
  }

  getMountedRiderY(): number {
    if (!this.mountedOnHorse) return this.reliefLift
    return this.reliefLift + MOUNTED_RIDER_Y_OFFSET + this.getMountedHorseBob()
  }

  getMountedRiderX(): number {
    if (!this.mountedOnHorse) return 0
    const direction = degreeToDirection(this.degree) ?? 'south'
    return mountedRiderXOffset(direction)
  }

  setupMountedHorseSprite() {
    if (!this.mountedOnHorse || this.horseSprite) return
    const horseSheet = getCachedSpritesheet(MOUNTED_HORSE_STANDING_SHEET)
    if (!horseSheet?.textures) return

    const { textures } = getSpriteFrameSelection(horseSheet.textures, this.degree, 3, null)
    this.horseSprite = new AnimatedSprite(recolorHorseTextures(textures as Texture[], this.horseColor))
    bindAnimatedSpriteToTicker(this.horseSprite, this.context.app)
    this.horseSprite.label = `${LABEL_TYPES.sprite}-horse`
    this.horseSprite.eventMode = 'none'
    this.horseSprite.roundPixels = true
    this.horseSprite.loop = true
    this.horseSprite.updateAnchor = true
    this.horseSprite.onFrameChange = () => this.syncMountedRiderPosition()
    this.addChild(this.horseSprite)
    this.horseShadow = this.createShadow(this.horseSprite, `${LABEL_TYPES.shadow}-horse`)
    this.context.map.shadowLayer?.addChild(this.horseShadow)
    this.setupMountedRiderLegsSprite()
    this.syncMountedHorseSprite()
  }

  setupMountedRiderLegsSprite() {
    if (!this.mountedOnHorse || this.mountedRiderLegsSprite) return
    const legsSheet = getCachedSpritesheet(MOUNTED_RIDER_LEGS_SHEET)
    if (!legsSheet?.textures) return

    const { textures } = getSpriteFrameSelection(legsSheet.textures, this.degree, 3, null)
    this.mountedRiderLegsSprite = new AnimatedSprite(textures as Texture[])
    bindAnimatedSpriteToTicker(this.mountedRiderLegsSprite, this.context.app)
    this.mountedRiderLegsSprite.label = `${LABEL_TYPES.sprite}-mounted-rider-legs`
    this.mountedRiderLegsSprite.eventMode = 'none'
    this.mountedRiderLegsSprite.roundPixels = true
    this.mountedRiderLegsSprite.loop = false
    this.mountedRiderLegsSprite.updateAnchor = true
    this.mountedRiderLegsSprite.zIndex = MAIN_SPRITE_LAYER_Z_INDEX - 1
    this.addChild(this.mountedRiderLegsSprite)
    this.syncMountedRiderLegsSprite()
  }

  syncMountedRiderPosition() {
    if (!this.sprite) return
    const riderX = this.getMountedRiderX()
    const riderY = this.getMountedRiderY()
    this.sprite.position.x = riderX
    this.sprite.position.y = riderY
    for (const layerSprite of this.appearanceLayerSprites.values()) {
      layerSprite.position.x = riderX
      layerSprite.position.y = riderY
    }
    this.syncMountedRiderLegsSprite()
    this.updateMountedRiderMask(this.currentSheet)
    const healthBar = this.getChildByLabel(LABEL_TYPES.healthBar)
    if (healthBar) healthBar.position.y = riderY
    const powerBar = this.getChildByLabel(LABEL_TYPES.powerBar)
    if (powerBar) powerBar.position.y = riderY
    const energyBar = this.getChildByLabel(LABEL_TYPES.energyBar)
    if (energyBar) energyBar.position.y = riderY
  }

  shouldUseMountedRiderCut(sheet = this.currentSheet): boolean {
    return Boolean(
      this.mountedOnHorse && [SHEET_TYPES.standing, SHEET_TYPES.walking, SHEET_TYPES.action].includes(sheet)
    )
  }

  updateMountedRiderMask(sheet = this.currentSheet) {
    if (!this.shouldUseMountedRiderCut(sheet) || !this.sprite?.textures?.length) {
      this.clearMountedRiderMask()
      return
    }

    const texture = this.sprite.textures[0] as Texture
    const frameHeight = texture.height || 64
    const scaleY = Math.max(0.001, Math.abs(this.sprite.scale.y || 1))
    const topY = this.sprite.position.y - this.sprite.anchor.y * frameHeight * scaleY
    const cutHeight = Math.min(MOUNTED_RIDER_CUT_Y, frameHeight) * scaleY

    if (!this.mountedRiderMask) {
      this.mountedRiderMask = new Graphics()
      this.mountedRiderMask.label = `${LABEL_TYPES.sprite}-mounted-rider-mask`
      this.mountedRiderMask.eventMode = 'none'
      this.addChild(this.mountedRiderMask)
    }

    this.mountedRiderMask.clear()
    this.mountedRiderMask.rect(-512, topY, 1024, cutHeight).fill({ color: 0xffffff })
    this.sprite.mask = this.mountedRiderMask
    for (const [spriteKey, layerSprite] of this.appearanceLayerSprites.entries()) {
      const layer = this.appearance?.layers[spriteKey]
      layerSprite.mask = layer?.mountedCut === false ? null : this.mountedRiderMask
    }
  }

  clearMountedRiderMask() {
    if (this.sprite) this.sprite.mask = null
    for (const layerSprite of this.appearanceLayerSprites.values()) {
      layerSprite.mask = null
    }
    if (!this.mountedRiderMask) return
    this.mountedRiderMask.parent?.removeChild(this.mountedRiderMask)
    this.mountedRiderMask.destroy()
    this.mountedRiderMask = null
  }

  getMountedRiderBodyTopLeft(): { x: number; y: number; width: number; scale: number } {
    const texture = (this.sprite.textures[0] as Texture | undefined) ?? null
    const width = texture?.width || 64
    const height = texture?.height || 64
    const scale = Math.max(0.001, Math.abs(this.sprite.scale.y || this.spriteScale || 1))
    const mirrored = this.sprite.scale.x < 0
    const x = mirrored
      ? this.sprite.position.x - (1 - this.sprite.anchor.x) * width * scale
      : this.sprite.position.x - this.sprite.anchor.x * width * scale
    const y = this.sprite.position.y - this.sprite.anchor.y * height * scale
    return { x, y, width, scale }
  }

  syncMountedRiderLegsSprite() {
    if (!this.mountedOnHorse) {
      this.removeMountedRiderLegsSprite()
      return
    }
    if (!this.mountedRiderLegsSprite) this.setupMountedRiderLegsSprite()
    if (!this.mountedRiderLegsSprite) return

    const legsSheet = getCachedSpritesheet(MOUNTED_RIDER_LEGS_SHEET)
    if (!legsSheet?.textures) return

    const { textures, mirrored } = getSpriteFrameSelection(legsSheet.textures, this.degree, 3, null)
    const body = this.getMountedRiderBodyTopLeft()
    const direction = degreeToDirection(this.degree) ?? 'south'
    const legOffset = mountedRiderLegOffset(direction, body.scale)

    this.mountedRiderLegsSprite.textures = textures as Texture[]
    this.mountedRiderLegsSprite.anchor.set(0, 0)
    this.mountedRiderLegsSprite.scale.x = mirrored ? -body.scale : body.scale
    this.mountedRiderLegsSprite.scale.y = body.scale
    this.mountedRiderLegsSprite.position.x = body.x + (mirrored ? body.width * body.scale - legOffset.x : legOffset.x)
    this.mountedRiderLegsSprite.position.y = body.y + legOffset.y
    this.mountedRiderLegsSprite.animationSpeed = 0
    this.mountedRiderLegsSprite.gotoAndStop(0)
  }

  removeMountedRiderLegsSprite() {
    if (!this.mountedRiderLegsSprite) return
    this.mountedRiderLegsSprite.parent?.removeChild(this.mountedRiderLegsSprite)
    this.mountedRiderLegsSprite.destroy({ children: true, texture: false })
    this.mountedRiderLegsSprite = null
  }

  syncMountedHorseSprite() {
    if (!this.mountedOnHorse) {
      this.removeMountedHorseSprite()
      return
    }
    if (!this.horseSprite) this.setupMountedHorseSprite()
    if (!this.mountedRiderLegsSprite) this.setupMountedRiderLegsSprite()
    if (!this.horseSprite) return

    const horseShouldMove = this.currentSheet === SHEET_TYPES.walking || this.isDirectMoving
    const sheetId = horseShouldMove ? MOUNTED_HORSE_WALKING_SHEET : MOUNTED_HORSE_STANDING_SHEET
    const horseSheet = getCachedSpritesheet(sheetId)
    if (!horseSheet?.textures) return

    const frame = Math.min(this.horseSprite.currentFrame, Math.max(this.horseSprite.textures.length - 1, 0))
    const { textures, mirrored } = getSpriteFrameSelection(horseSheet.textures, this.degree, 3, null)
    const spriteScale = this.spriteScale ?? 1
    this.horseSprite.textures = recolorHorseTextures(textures as Texture[], this.horseColor)
    this.horseSprite.scale.x = mirrored ? -spriteScale : spriteScale
    this.horseSprite.scale.y = spriteScale
    this.horseSprite.animationSpeed = horseSheet.data?.animationSpeed ?? 0.2
    this.horseSprite.position.y = this.reliefLift
    const defaultAnchor = (this.horseSprite.textures[0] as Texture & { defaultAnchor?: { x: number; y: number } })
      .defaultAnchor
    if (defaultAnchor) {
      this.horseSprite.anchor.set(defaultAnchor.x, defaultAnchor.y)
    }

    // This container has sortableChildren enabled, so Pixi re-sorts children by zIndex on every render.
    // The horse must therefore be ordered via its own zIndex, not by moving it around in the children array.
    const direction = degreeToDirection(this.degree) ?? 'south'
    const horseInFront = MOUNTED_HORSE_DIRECTIONS_IN_FRONT.has(direction)
    this.horseSprite.zIndex = horseInFront ? MOUNTED_HORSE_FRONT_Z_INDEX : MOUNTED_HORSE_BEHIND_Z_INDEX

    if (this.context.paused) {
      this.horseSprite.gotoAndStop(Math.min(frame, this.horseSprite.textures.length - 1))
    } else {
      this.horseSprite.gotoAndPlay(Math.min(frame, this.horseSprite.textures.length - 1))
    }
    this.syncMountedRiderLegsSprite()
    this.syncShadow(this.horseShadow, this.horseSprite)
  }

  removeMountedHorseSprite() {
    this.clearMountedRiderMask()
    this.removeMountedRiderLegsSprite()
    if (this.horseShadow) {
      this.horseShadow.parent?.removeChild(this.horseShadow)
      this.horseShadow.destroy({ children: true, texture: false })
      this.horseShadow = null
    }
    if (!this.horseSprite) return
    this.horseSprite.parent?.removeChild(this.horseSprite)
    this.horseSprite.destroy({ children: true, texture: false })
    this.horseSprite = null
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
    const layers = this.appearance?.layers
    const mountedRiderSheet =
      this.mountedOnHorse && [SHEET_TYPES.standing, SHEET_TYPES.walking].includes(sheet) ? SHEET_TYPES.action : sheet
    if (!layers?.length) {
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
      const actionWorkKey = this.work && this.action ? `${this.work}:${this.action}` : undefined
      const hasActionWorkSheetOverride = Boolean(actionWorkKey && layer.actionWorkSheetOverrides?.[actionWorkKey])
      const isLayerEnabledForWork =
        !layer.workTypes?.length ||
        (this.work ? layer.workTypes.includes(this.work) : false) ||
        hasActionWorkSheetOverride
      const isLayerEnabledForCivilization =
        !layer.civilizations?.length || layer.civilizations.includes(civilizationKey(this.owner?.civ))
      const unitLevel = getUnitEquipmentLevel(this)
      const isLayerEnabledForLevel =
        unitLevel >= (layer.minLevel ?? 0) && unitLevel <= (layer.maxLevel ?? Number.POSITIVE_INFINITY)
      const isLoading = (this.loading ?? 0) > 0
      // Carried resources are hidden while the action animation plays, then restored
      // automatically when the unit returns to standing/walking.
      const isLayerHiddenByLoading = isAppearanceLayerHiddenByLoading({
        layer,
        isLoading,
        sheet,
        heroControlled,
      })
      const isLayerHiddenByAction = Boolean(this.action && layer.hideForActions?.includes(this.action))
      const isLayerHiddenByFrame =
        sheet === SHEET_TYPES.action &&
        typeof layer.hideOnOrAfterFrame === 'number' &&
        this.sprite.currentFrame >= layer.hideOnOrAfterFrame
      const equipmentKey = layer.equipmentKey
      const isLootedCorpseEquipment =
        this.isDead &&
        Array.isArray(this.lootEquipment) &&
        equipmentKey != null &&
        !this.lootEquipment.includes(equipmentKey)
      const loadedSheetOverride =
        !this.mountedOnHorse && this.loading && sheet === SHEET_TYPES.walking
          ? (layer.loadedSheet as string | undefined)
          : undefined
      const actionWorkSheetOverride = actionWorkKey
        ? layer.actionWorkSheetOverrides?.[actionWorkKey]?.[mountedRiderSheet]
        : undefined
      const workSheetOverride = this.work ? layer.workSheetOverrides?.[this.work]?.[mountedRiderSheet] : undefined
      const ownerAge = Math.max(0, Math.floor(this.owner?.age ?? 0))
      const ageSheetOverride = getLevelSheetOverride(layer.ageSheetOverrides, ownerAge, mountedRiderSheet)
      const isRangedActionSheet =
        sheet === SHEET_TYPES.action && (this.type === UNIT_TYPES.bowman || this.work === WORK_TYPES.hunter)
      const shootingSheetOverride = isRangedActionSheet
        ? getLevelSheetOverride(layer.ageSheetOverrides, ownerAge, 'shootingSheet') ?? layer.shootingSheet
        : undefined
      const mountedSheetOverride =
        this.mountedOnHorse && [SHEET_TYPES.standing, SHEET_TYPES.walking, SHEET_TYPES.action].includes(sheet)
          ? layer.mountedSheet
          : undefined
      const baseSheetId =
        loadedSheetOverride ??
        shootingSheetOverride ??
        actionWorkSheetOverride ??
        workSheetOverride ??
        mountedSheetOverride ??
        ageSheetOverride ??
        (layer[mountedRiderSheet as keyof RuntimeAppearanceLayer] as string | undefined)
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
      const sheetId = variantSheetId && Assets.cache.has(variantSheetId) ? variantSheetId : basePlayerColorSheetId
      const spritesheet = sheetId ? getCachedSpritesheet(sheetId) : undefined
      const spriteKey = i
      liveLayers.add(spriteKey)

      if (
        !isLayerEnabledForWork ||
        !isLayerEnabledForCivilization ||
        !isLayerEnabledForLevel ||
        isLayerHiddenByLoading ||
        isLayerHiddenByAction ||
        isLayerHiddenByFrame ||
        isLootedCorpseEquipment ||
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

      const directionCount =
        layer.sheetDirectionCounts?.[mountedRiderSheet] ?? this.sheetDirectionCounts?.[mountedRiderSheet] ?? null
      const directionOrderOverride = (layer.sheetDirectionOrders?.[mountedRiderSheet] ??
        this.sheetDirectionOrders?.[mountedRiderSheet] ??
        null) as string[] | null
      const { textures, mirrored } = getSpriteFrameSelection(
        spritesheet.textures,
        this.degree,
        directionCount,
        directionOrderOverride
      )

      let layerSprite = this.appearanceLayerSprites.get(spriteKey)
      const frameIndex =
        mountedSheetOverride || (this.mountedOnHorse && sheet !== SHEET_TYPES.action)
          ? 0
          : Math.min(this.sprite.currentFrame, Math.max(textures.length - 1, 0))

      if (!layerSprite) {
        layerSprite = new AnimatedSprite(textures as Texture[])
        bindAnimatedSpriteToTicker(layerSprite, this.context.app)
        layerSprite.label = `${LABEL_TYPES.sprite}-layer-${spriteKey}`
        layerSprite.eventMode = 'none'
        layerSprite.position.x = this.getMountedRiderX()
        layerSprite.position.y = this.getMountedRiderY()
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
      layerSprite.loop = this.sprite.loop
      layerSprite.position.x = this.getMountedRiderX()
      layerSprite.position.y = this.getMountedRiderY()
      layerSprite.zIndex = layer.zIndex
      layerSprite.textures = textures as Texture[]
      if (layer.palette === 'player') {
        changeSpriteColor(layerSprite, this.owner.color ?? '')
      } else {
        layerSprite.filters = null
      }
      const spriteScale = this.spriteScale ?? 1
      layerSprite.scale.x = mirrored ? -spriteScale : spriteScale
      layerSprite.scale.y = spriteScale
      const defaultAnchor = (layerSprite.textures[0] as Texture & { defaultAnchor?: { x: number; y: number } })
        .defaultAnchor
      if (defaultAnchor) {
        layerSprite.anchor.set(defaultAnchor.x, defaultAnchor.y)
      }
      layerSprite.animationSpeed = spritesheet.data?.animationSpeed ?? 0.18
      layerSprite.onFrameChange =
        sheet === SHEET_TYPES.action && typeof layer.hideOnOrAfterFrame === 'number'
          ? currentFrame => {
              layerSprite.visible = currentFrame < layer.hideOnOrAfterFrame!
            }
          : undefined
      layerSprite.currentFrame = frameIndex
      layerSprite.visible =
        sheet === SHEET_TYPES.action && typeof layer.hideOnOrAfterFrame === 'number'
          ? frameIndex < layer.hideOnOrAfterFrame
          : true
      if (mountedSheetOverride || (this.mountedOnHorse && sheet !== SHEET_TYPES.action)) {
        layerSprite.gotoAndStop(frameIndex)
      } else if (this.sprite.playing) {
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
    if (this.context.editor) {
      return
    }
    if (!instance || this.isDead) {
      return
    }
    markUnitHealthDamaged(this)
    if (!canAutoReactToAttack(this)) {
      return
    }
    this.owner.reportThreat?.(this, instance)
    const moraleDecision = evaluateCombatMorale(this, instance)
    if (moraleDecision === 'surrender') {
      if (instance.family === FAMILY_TYPES.unit) {
        showAggressionFeedback(this)
        if (new UnitActions(instance as UnitEntity).convertTarget(this, { grantXp: false, stopConverter: false }))
          return
      }
      this.runaway(instance)
      return
    }
    if (moraleDecision === 'flee') {
      this.runaway(instance)
      return
    }
    if (shouldSuppressAggroDuringCombatRecovery(this)) {
      return
    }
    if (this.handleIsAttacked?.(instance, this)) return
    if (!this.getActionCondition(instance, ACTION_TYPES.attack)) {
      return
    }
    if (this.dest === instance) {
      return
    }
    const currentDest = this.dest
    showAggressionFeedback(this)
    if (this.context.villagerShelter?.handleVillagerDangerShelter(this, instance)) {
      this.previousDest = currentDest
      return
    }
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
    if (this.isDead || this.isDestroyed) return
    const heroControlled = isHeroControlled(this)
    const currentCellOccupant = this.currentCell.has
    const currentCellHasBlockingOccupant = Boolean(
      !heroControlled &&
        this.currentCell.solid &&
        currentCellOccupant &&
        currentCellOccupant.label !== this.label &&
        !currentCellOccupant.isDestroyed
    )
    if (currentCellHasBlockingOccupant) {
      debugBanditStop(this, 'stop-current-cell-occupied')
    } else if (!heroControlled && this.currentCell.solid && currentCellOccupant?.label !== this.label) {
      debugBanditStop(this, 'stop-repairing-stale-current-cell')
      this.currentCell.place(this)
      this.currentCell.solid = true
    }
    if (!heroControlled && resumeVillagerAutonomy?.(this)) return
    clearCombatAttackRecovery(this)
    this.handleChangeDest()
    this.actionLocked = false
    this.pendingOrder = null
    this.blockedGatherApproach = null
    this.inactif = true
    this.action = null
    this.dest = null
    this.realDest = null
    this.sprite.loop = this.loop ?? true
    if (this.shadow) this.shadow.loop = this.sprite.loop
    for (const sprite of this.appearanceLayerSprites.values()) {
      sprite.loop = this.loop ?? true
    }
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
      this.contextAction = null
      applyToolAppearance(this, this.context?.controls?.equippedTool ?? 'interact')
    } else if (!this.currentCell.has || this.currentCell.has.label === this.label || this.currentCell.has.isDestroyed) {
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
