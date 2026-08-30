import { Assets, AnimatedSprite } from 'pixi.js'
import type { Texture } from 'pixi.js'
import {
  FAMILY_TYPES,
  LABEL_TYPES,
  MOUNTED_HORSE_SPEED_BONUS,
  SHEET_TYPES,
  SOUND_CUES,
  UNIT_TYPES,
  WORK_TYPES,
} from '../../constants'
import {
  bindAnimatedSpriteToTicker,
  attachEntityShadowsToMapSpace,
  cartesianToIsometric,
  getAnimationFrames,
  getIconPath,
  getInstanceZIndex,
  getGroundReliefLevel,
  getEntityMapSpace,
  getEntityCell,
  playAudibleSoundCue,
  throttle,
  updateInstanceVisibility,
} from '../../lib'
import { heroCanCommand } from '../../lib/chief'
import { refreshUnitEquipmentStats } from '../../lib/equipment/equipmentStats'
import { getHorseColorFromSeed, isHorseColor } from '../../lib/horses/horseColors'
import { t } from '../../lib/lang'
import { applyBakedLpcUnitAssets, resolveLpcAppearanceVariants } from '../../lib/lpc'
import { onVisualSettingsChange } from '../../lib/audio/settings'
import { ensureUnitEnergy } from '../../lib/units/unitEnergy'
import { ensureUnitHealthRegen } from '../../lib/units/unitHealth'
import { getUnitWorkActionSheet } from '../../lib/units/unitWorkAppearance'
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

const MAIN_SPRITE_LAYER_Z_INDEX = 10

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
      resolveLpcAppearanceVariants(unit.owner.civ, `${unit.owner.label}:${unit.label}:${unit.i}:${unit.j}`)
    unit.assets = applyAppearanceVariantsToAssets(unit.assets, unit.appearanceVariants)
    unit.allAssets = applyAppearanceVariantsToAssetMap(unit.allAssets, unit.appearanceVariants)
  }
  applyBakedLpcUnitAssets(unit)
  unit.size = 1
  unit.visible = false
  unit.visibleCells = new Set()
  const space = getEntityMapSpace(unit, map)
  const grid = space?.grid ?? map.grid
  const spawnCell = grid[unit.i][unit.j]
  const [flatSpawnX, flatSpawnY] = cartesianToIsometric(unit.i, unit.j)
  unit.x = unitConfig.x ?? options.x ?? flatSpawnX
  unit.y = unitConfig.y ?? options.y ?? flatSpawnY
  unit.z = unitConfig.z ?? options.z ?? spawnCell.z
  unit.zIndex = getInstanceZIndex(unit)
  unit.quantity = unit.quantity ?? unit.totalQuantity
  unit.hitPoints = unit.hitPoints ?? unit.totalHitPoints
  ensureUnitEnergy(unit)
  ensureUnitHealthRegen(unit)
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
  const assets = unit.assets ?? unit.allAssets?.default
  if (!assets) return
  for (const [key, value] of Object.entries(assets)) {
    Object.assign(unit, { [key]: getCachedUnitSpritesheet(value) })
  }
}

export function playUnitCreateSound(unit: UnitRuntimeHost, options: UnitSpawnOptions): void {
  if (
    !options.suppressCreateSound &&
    unit.owner.isPlayed &&
    unit.context.map.ready &&
    unit.context.controls.instanceIsAudible?.(unit)
  ) {
    playAudibleSoundCue(unit, (unit.sounds && unit.sounds.create) || SOUND_CUES.unit.fallbackCreate, { profile: 'voice' })
  }
}

export function setupUnitInterface(unit: UnitRuntimeHost): void {
  const { menu } = unit.context
  unit.interface = {
    info: (element: HTMLElement, options?: EntityInfoRenderOptions) => {
      const data = unit.owner.config.units[unit.type] as UnitConfig
      unit.setDefaultInterface?.(element, data, options)
    },
    menu:
      unit.owner.isPlayed && !unit.context.editor
        ? [
            ...(unit.showBuildings
              ? [
                  {
                    id: 'build',
                    icon: getIconPath('002_50721'),
                    tooltip: () => ({
                      title: t('buildMenu'),
                      description: t('buildMenuDescription'),
                      meta: heroCanCommand(unit.context.controls.heroUnit) ? [] : [t('requiresChief')],
                    }),
                    disabled: () => !heroCanCommand(unit.context.controls.heroUnit),
                    children: Object.keys(unit.owner.config.buildings)
                      .map(key => menu.getActionBuildingButton?.(key, unit.owner))
                      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
                  },
                ]
              : []),
          ]
        : [],
  }
}

export function setupUnitPrimarySprite(unit: UnitRuntimeHost, spawnCell: RuntimeCell): void {
  unit.eventMode = 'static'
  unit.actionSheet = unit.actionSheet || getUnitWorkActionSheet(unit, unit.work, unit.action)
  unit.sprite = new AnimatedSprite(
    getAnimationFrames((unit.standingSheet as { textures: Record<string, Texture> }).textures, 'south') as Texture[]
  )
  bindAnimatedSpriteToTicker(unit.sprite, unit.context.app)
  unit.sprite.label = LABEL_TYPES.sprite
  unit.sprite.eventMode = 'auto'
  unit.sprite.roundPixels = true
  unit.sprite.loop = unit.loop ?? true
  unit.sprite.zIndex = MAIN_SPRITE_LAYER_Z_INDEX
  unit.shadow = unit.createShadow?.() ?? null
  attachEntityShadowsToMapSpace(unit.context.map, unit)
  unit.addChild(unit.sprite)
  unit.setupMountedHorseSprite?.()
  unit.visualSettingsCleanup = onVisualSettingsChange(() => unit.syncVisualSettings?.())
  if (unit.isDead) {
    unit.currentSheet === SHEET_TYPES.corpse ? unit.decompose?.() : unit.death?.()
  }
  unit.setTextures?.(unit.currentSheet)

  unit.sprite.currentFrame = Math.min(unit.currentFrame, unit.sprite.textures.length - 1)
  unit.syncShadow?.()
  unit.syncAppearanceLayers?.(unit.currentSheet)
  unit.applyReliefLift?.(getGroundReliefLevel(spawnCell), true)
  unit.sprite.updateAnchor = true
  if (unit.shouldKeepHealthBarVisible?.()) {
    unit.drawHealthBar?.()
    unit.drawEnergyBar?.()
  }
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

export function setupUnitPointerInteraction(unit: UnitRuntimeHost): void {
  unit.on('pointerup', () => {
    const {
      context: { controls, editor },
    } = unit
    if (editor?.handleEntityInteraction?.(unit)) return
    if (controls.rallyPointController?.active) {
      controls.mouse.prevent = true
      controls.rallyPointController.handleMouseUpOnEntity(unit)
    }
  })
}

export function scheduleInitialUnitVisibilityUpdate(unit: UnitRuntimeHost): void {
  unit.visibilityTimeout = setTimeout(() => {
    if (!unit.isDestroyed) updateInstanceVisibility(unit)
  })
}
