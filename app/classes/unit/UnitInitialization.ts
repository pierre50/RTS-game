import { initializeWorkTools } from '../../lib/equipment/workToolMigration'
import { initializeNpcWeapons } from '../../lib/units/combat/npcWeapons'
import { getUnitEquipment, getUnitWorkEquipment } from '../../lib/equipment/equipmentStats'
import { initializeNpcArrows } from '../../lib/units/combat/unitArrows'
import { reconcileSettlementResidents } from '../../lib/territory/settlementResidents'
import { removeLegacyQuiver } from '../../lib/equipment/heroInventory'
import { migrateEquipmentInventory } from '../../lib/equipment/armorVariants'
import { getVillagerSchedule } from '../../lib/units/village/villagerSchedule'
import { Assets } from 'pixi.js'
import { FAMILY_TYPES, MOUNTED_HORSE_SPEED_BONUS, SHEET_TYPES, UNIT_TYPES, WORK_TYPES } from '../../constants'
import {
  cartesianToIsometric,
  getInstanceZIndex,
  getEntityMapSpace,
  getEntityCell,
  throttle,
  updateInstanceVisibility,
} from '../../lib'
import { refreshUnitEquipmentStats } from '../../lib/equipment/equipmentStats'
import { getHorseColorFromSeed, isHorseColor } from '../../lib/horses/horseColors'
import { applyBakedLpcUnitAssets, resolveLpcAppearanceVariants } from '../../lib/lpc'
import { ensureUnitEnergy } from '../../lib/units/unitEnergy'
import { applyUnitActivitySpritesheets } from '../../lib/units/visuals/unitSpriteAssets'
import { UnitInterface } from '../../ui/entity/UnitInterface'
import { UnitActions } from './UnitActions'
import { UnitCombat } from './UnitCombat'
import { UnitCommands } from './UnitCommands'
import { UnitLifecycle } from './UnitLifecycle'
import { UnitMovement } from './movement/UnitMovement'
import type { EntityInfoRenderOptions, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { SpritesheetLike } from '../../types/pixi'
import type { UnitConfig } from '../../types/config'
import type { UnitRuntimeHost, UnitSpawnOptions } from './UnitTypes'

type PositionedConfig = { x?: number; y?: number; z?: number | null }
type AssignableUnit = UnitRuntimeHost & { assignProperties(source: object | null | undefined): void }

export function getCachedUnitSpritesheet(id: string): SpritesheetLike | undefined {
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

export function initializeUnitServices(unit: UnitRuntimeHost): void {
  unit.family = FAMILY_TYPES.unit
  unit.unitInterface = new UnitInterface(unit)
  unit.unitCommands = new UnitCommands(unit)
  unit.unitLifecycle = new UnitLifecycle(unit)
  unit.unitCombat = new UnitCombat(unit)
  unit.unitActions = new UnitActions(unit)
  unit.unitMovement = new UnitMovement(unit)
  unit.shadow = null
  unit.horseSprite = null
  unit.horseShadow = null
  unit.mountedRiderLegsSprite = null
  unit.mountedRiderMask = null
  unit.visualSettingsCleanup = null
  unit.appearanceLayerSprites = new Map()
  unit.reliefLift = 0
}

export function initializeUnitRuntimeState(unit: UnitRuntimeHost): void {
  const { map } = unit.context
  unit.dest = null
  unit.realDest = null
  unit.previousDest = null
  unit.previousWork = null
  unit.blockedGatherApproach = null
  unit.resourceDeliveryState = null
  unit.buildQueue = []
  unit.path = []
  unit.degree = map.randomRange(1, 360)
  unit.currentFrame = map.randomRange(0, 4)
  unit.action = null
  unit.controlMode = 'standard'
  unit.actionLocked = false
  unit.pendingOrder = null
  unit.currentSheet = SHEET_TYPES.standing
  unit.inactif = true
  unit.experience = {}
}

export function applyUnitSpawnConfiguration(unit: UnitRuntimeHost, options: UnitSpawnOptions): RuntimeCell {
  const { map } = unit.context
  const assignableUnit = unit as unknown as AssignableUnit
  assignableUnit.assignProperties(options)
  const unitConfig = unit.owner.config.units[unit.type] as (typeof unit.owner.config.units)[string] & PositionedConfig
  assignableUnit.assignProperties(unitConfig)
  // Saved promotions take precedence over the unit type's default role.
  unit.isChief = options.isChief ?? unit.isChief
  unit.homeHouseLabel = options.homeHouseLabel
  unit.homeBedLabel = options.homeBedLabel
  unit.partnerLabel = options.partnerLabel
  if (unit.type === UNIT_TYPES.villager) {
    unit.lastMealAt = options.lastMealAt
    unit.dailySchedule = options.dailySchedule ? { ...options.dailySchedule } : undefined
    getVillagerSchedule(unit)
  }
  if (options.equipmentDurability) unit.equipmentDurability = { ...options.equipmentDurability }
  const inventory = options.inventory ?? unit.inventory
  if (inventory) {
    unit.inventory = structuredClone(inventory)
    migrateEquipmentInventory(unit.inventory)
    removeLegacyQuiver(unit.inventory)
  }
  initializeNpcWeapons(unit, [
    ...getUnitEquipment(unit.type, unitConfig, unit.owner, undefined, unit.owner.civ),
    ...(unit.type === UNIT_TYPES.villager
      ? [...getUnitWorkEquipment('hunter', unit), ...getUnitWorkEquipment(unit.work, unit)]
      : []),
  ])
  initializeWorkTools(unit)
  initializeNpcArrows(unit)
  unit.mountedOnHorse = options.mountedOnHorse ?? unit.mountedOnHorse
  if (unit.mountedOnHorse) {
    unit.horseColor = isHorseColor(options.horseColor)
      ? options.horseColor
      : isHorseColor(unit.horseColor)
        ? unit.horseColor
        : getHorseColorFromSeed(`${unit.owner?.label}:${unit.type}:${unit.i}:${unit.j}:${unit.label}`)
  }
  unit.hitPoints = options.hitPoints ?? unit.hitPoints
  unit.speed = options.speed ?? unit.speed
  if (unit.mountedOnHorse && options.speed == null) unit.speed = (unit.speed ?? 0) + MOUNTED_HORSE_SPEED_BONUS
  unit.experience = options.experience ? { ...options.experience } : unit.experience
  if (unit.appearance) {
    unit.appearance = { ...unit.appearance, layers: unit.appearance.layers.map(layer => ({ ...layer })) }
    unit.appearanceVariants =
      unit.appearanceVariants ??
      resolveLpcAppearanceVariants(
        unit.assetCiv || unit.owner.civ,
        `${unit.owner.label}:${unit.label}:${unit.i}:${unit.j}`
      )
    unit.assets = applyAppearanceVariantsToAssets(unit.assets, unit.appearanceVariants)
    unit.allAssets = applyAppearanceVariantsToAssetMap(unit.allAssets, unit.appearanceVariants)
  }
  applyBakedLpcUnitAssets(unit)
  unit.size = 1
  unit.visible = false
  unit.visibleCells = new Set()
  const space = getEntityMapSpace(unit, map)
  const grid = space?.grid ?? map.grid
  const spawnCell = grid[unit.i]?.[unit.j]
  if (!spawnCell) throw new Error(`Cannot spawn unit on missing cell (${unit.i}, ${unit.j})`)
  const [flatSpawnX, flatSpawnY] = cartesianToIsometric(unit.i, unit.j)
  unit.x = unitConfig.x ?? options.x ?? flatSpawnX
  unit.y = unitConfig.y ?? options.y ?? flatSpawnY
  unit.z = unitConfig.z ?? options.z ?? spawnCell.z
  unit.zIndex = getInstanceZIndex(unit)
  unit.quantity = unit.quantity ?? unit.totalQuantity
  unit.hitPoints = unit.hitPoints ?? unit.totalHitPoints
  ensureUnitEnergy(unit)
  return spawnCell
}

export function registerInitialUnitMapPresence(unit: UnitRuntimeHost): void {
  const { map } = unit.context
  const currentCell = getEntityCell(unit, map)
  if (!currentCell) return
  unit.currentCell = currentCell
  if (unit.currentSheet === SHEET_TYPES.corpse) {
    unit.owner.corpses.push(unit)
    currentCell.corpses.add(unit)
  } else if (!unit.isDead) {
    unit.currentCell.place(unit)
    unit.currentCell.solid = true
    unit.owner.units.push(unit)
    reconcileSettlementResidents({ ...unit.owner, units: [unit] })
    map.addToInstanceBucket(unit)
  }
}

export function initializeUnitWorkRole(unit: UnitRuntimeHost): void {
  switch (unit.type) {
    case UNIT_TYPES.villager:
      unit.work = unit.work || null
      break
    case 'Priest':
      unit.work = WORK_TYPES.healer
      break
    default:
      unit.work = WORK_TYPES.attacker
  }
  refreshUnitEquipmentStats(unit)
}

export function loadConfiguredUnitSpritesheets(unit: UnitRuntimeHost): void {
  applyUnitActivitySpritesheets(unit)
}

export function setupUnitInterface(unit: UnitRuntimeHost): void {
  unit.interface = {
    info: (element: HTMLElement, options?: EntityInfoRenderOptions) => {
      const data = unit.owner.config.units[unit.type] as UnitConfig
      unit.setDefaultInterface?.(element, data, options)
    },
    menu: [],
  }
}

export function assertUnitVisualAssets(unit: UnitRuntimeHost): void {
  if (unit.standingSheet?.textures) return
  throw new Error(
    `Missing standing spritesheet for ${unit.type} (${unit.owner.civ ?? 'Hellas'}): ${unit.assets?.standingSheet ?? unit.allAssets?.default?.standingSheet}`
  )
}

export function setupUnitCommandDispatch(unit: UnitRuntimeHost): void {
  unit.sendTo = unit.owner.isPlayed
    ? throttle(
        (target: RuntimeCell | RuntimeEntity, action?: string) => {
          unit.sendToEvt?.(target, action)
        },
        100,
        true
      )
    : (target: RuntimeCell | RuntimeEntity, action?: string) => {
        unit.sendToEvt?.(target, action)
      }
}

export function scheduleInitialUnitVisibilityUpdate(unit: UnitRuntimeHost): void {
  unit.visibilityTimeout = setTimeout(() => {
    if (!unit.isDestroyed) updateInstanceVisibility(unit)
  })
}
