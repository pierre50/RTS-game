import { Assets } from 'pixi.js'
import {
  dynamicEquipmentAssets,
  dynamicEquipmentLayersForEquipment,
  dynamicEquipmentLayersForUnit,
  dynamicEquipmentLayersForVillager,
} from './equipment'
import {
  heroAppearanceAssetsForPlayers,
  heroAppearanceLayersForPlayer,
  registerHeroAppearanceAliasesForPlayers,
} from './heroAppearance'
import { isAssetCached, loadBakedUnitVariant, registerDynamicEquipmentAliases } from './bakedAliasCache'
import { isChiefUnit } from '../chief'
import { getUnitEquipmentLevel } from '../units/unitExperience'
import { SHEET_TYPES, UNIT_TYPES, WORK_TYPES } from '../../constants'
import {
  BAKED_UNITS,
  bakedUnitActionAlias,
  bakedUnitAlias,
  bakedUnitForType,
  bakedVariantKey,
  forcedGenderForBakedUnit,
  gendersForBakedUnit,
  heroActionAlias,
  heroBodyAlias,
  isBakedInfantryRuntimeType,
  isVillagerLikeBakedUnit,
  villagerActionAlias,
  villagerBodyAlias,
  type BakedUnitType,
} from './bakedAliases'
import type { UnitAppearanceLayerConfig } from '../../types/config'
import type { UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

const INFANTRY_HELMET_MIN_LEVEL = 6

function isEquipmentKey(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0
}

function getInventoryAppearanceEquipment(unit: UnitEntity): string[] {
  const { offhand, arrow, ...equippedWithoutOffhand } = unit.inventory?.equipped ?? {}
  const equipped = Object.values(equippedWithoutOffhand).filter(isEquipmentKey)
  const activeWeapons = unit.inventory?.activeWeapons ?? {}
  if (unit.work === 'heroSword') {
    return [...equipped, offhand, activeWeapons.melee, activeWeapons.offhand].filter(isEquipmentKey)
  }
  if (unit.work === WORK_TYPES.hunter) {
    return [...equipped, activeWeapons.ranged, activeWeapons.quiver, arrow].filter(isEquipmentKey)
  }
  return equipped
}

function usesAssignableHeroWeapons(unit: UnitEntity): boolean {
  return unit.controlMode === 'hero' || unit.type === UNIT_TYPES.hero || Boolean(unit.inventory)
}

function isLayerReplacedByActiveWeapon(layer: UnitAppearanceLayerConfig, unit: UnitEntity): boolean {
  const activeWeapons = unit.inventory?.activeWeapons
  if (!activeWeapons || !layer.equipmentKey) return false
  if (activeWeapons.melee && layer.workTypes?.includes('heroSword')) return true
  if (!layer.workTypes?.includes(WORK_TYPES.hunter)) return false
  if (activeWeapons.ranged && (layer.equipmentKey.startsWith('bow') || layer.equipmentKey.startsWith('arrow_'))) {
    return true
  }
  return Boolean(activeWeapons.quiver && layer.equipmentKey === 'quiver')
}

function isDefaultHeroWeaponLayer(layer: UnitAppearanceLayerConfig, unit: UnitEntity): boolean {
  if (!usesAssignableHeroWeapons(unit) || !layer.equipmentKey) return false
  if (layer.workTypes?.includes('heroSword')) return true
  if (!layer.workTypes?.includes(WORK_TYPES.hunter)) return false
  return (
    layer.equipmentKey === 'quiver' || layer.equipmentKey.startsWith('bow') || layer.equipmentKey.startsWith('arrow_')
  )
}

function isHelmetEquipmentKey(equipment: string): boolean {
  return equipment.startsWith('helmet_') || equipment.includes('_hood_')
}

function getCorpseAppearanceEquipment(unit: UnitEntity): readonly string[] | null {
  if (!unit.isDead) return null
  if (Array.isArray(unit.lootEquipment)) return unit.lootEquipment
  if (Array.isArray(unit.equipment)) return unit.equipment
  return null
}

// Resolves the baked walking/standing sheet alias for a unit TYPE (not a live
// instance) — used for previews (e.g. training-button portraits) where there's
// no UnitEntity yet to read appearance off of.
export function getBakedUnitStandingSheetAlias(
  type: string,
  owner: Pick<PlayerLike, 'civ' | 'gender' | 'label'>
): string | null {
  const bakedUnit = bakedUnitForType(type)
  if (!bakedUnit) return null

  const variant = bakedVariantKey(bakedUnit, owner, type, forcedGenderForBakedUnit(bakedUnit))
  if (isVillagerLikeBakedUnit(bakedUnit)) {
    const bodyAlias = bakedUnit === 'hero' ? heroBodyAlias : villagerBodyAlias
    return bodyAlias(variant, 'walking')
  }
  return bakedUnitAlias(bakedUnit, variant, 'walking')
}

function resolveBakedUnitForRuntime(unit: UnitEntity): BakedUnitType | undefined {
  const bakedUnit: BakedUnitType | undefined =
    unit.controlMode === 'hero' ? 'hero' : isChiefUnit(unit) ? 'chief' : bakedUnitForType(unit.type)
  if (bakedUnit !== 'infantry' || !isBakedInfantryRuntimeType(unit.type)) return bakedUnit
  const corpseEquipment = getCorpseAppearanceEquipment(unit)
  if (corpseEquipment) return corpseEquipment.some(isHelmetEquipmentKey) ? 'infantry_nohair' : 'infantry'
  return getUnitEquipmentLevel(unit) >= INFANTRY_HELMET_MIN_LEVEL ? 'infantry_nohair' : 'infantry'
}

function resolveBakedRuntimeVariant(unit: UnitEntity, bakedUnit: BakedUnitType): string | null {
  if (!unit.owner) return null
  const preferredGender =
    unit.appearanceVariants?.gender ??
    forcedGenderForBakedUnit(bakedUnit) ??
    (bakedUnit === 'hero' ? unit.owner.gender : null)
  return bakedVariantKey(
    bakedUnit,
    unit.owner,
    `${unit.owner.label}:${unit.label}:${unit.i}:${unit.j}`,
    preferredGender
  )
}

export async function preloadBakedLpcUnitsForPlayers(
  players: Pick<PlayerLike, 'civ' | 'gender' | 'label' | 'heroAppearance'>[]
): Promise<void> {
  const variants = new Set<string>()
  for (const player of players) {
    for (const bakedUnit of BAKED_UNITS) {
      for (const gender of gendersForBakedUnit(bakedUnit)) {
        const variant = bakedVariantKey(bakedUnit, player, `${bakedUnit}:${gender}`, gender)
        variants.add(`${bakedUnit}:${variant}`)
      }
    }
  }

  await Promise.all(
    [...variants].map(entry => {
      const separator = entry.indexOf(':')
      const unit = entry.slice(0, separator) as BakedUnitType
      const variant = entry.slice(separator + 1)
      return loadBakedUnitVariant(unit, variant)
    })
  )

  const equipmentAssets = dynamicEquipmentAssets().filter(asset => !isAssetCached(asset.alias))
  if (equipmentAssets.length) {
    await Assets.load(equipmentAssets)
  }
  registerDynamicEquipmentAliases()

  const heroAppearanceAssets = heroAppearanceAssetsForPlayers(players)
  if (heroAppearanceAssets.length) {
    await Assets.load(heroAppearanceAssets)
  }
  registerHeroAppearanceAliasesForPlayers(players)
}

export function applyBakedLpcUnitAssets(unit: UnitEntity): boolean {
  // The player-controlled hero has its own config, but controlMode still wins here
  // because a promoted chief and a controlled hero can both be isChief units.
  const resolvedBakedUnit = resolveBakedUnitForRuntime(unit)
  const variant = resolvedBakedUnit ? resolveBakedRuntimeVariant(unit, resolvedBakedUnit) : null
  if (!resolvedBakedUnit || !variant) return false

  // Player setup gender only drives the controlled hero/avatar. Regular units
  // keep a spawn-time mix so a batch like "spawn villager 10" is visually varied.
  const gender = variant.endsWith('female') ? 'female' : 'male'
  const isVillagerLike = isVillagerLikeBakedUnit(resolvedBakedUnit)
  const bodyAlias = resolvedBakedUnit === 'hero' ? heroBodyAlias : villagerBodyAlias
  const walking = isVillagerLike ? bodyAlias(variant, 'walking') : bakedUnitAlias(resolvedBakedUnit, variant, 'walking')
  if (!isAssetCached(walking)) return false

  unit.appearance = undefined
  unit.appearanceVariants = { gender }
  unit.sheetDirectionCounts = {
    standingSheet: 3,
    walkingSheet: 3,
    actionSheet: 3,
    harvestSheet: 3,
    dyingSheet: 1,
    corpseSheet: 1,
  }

  // The hero keeps swapping tools (axe/pickaxe/bow/...) exactly like a villager
  // does — that's driven by unit.work, not by unit.type — so it reuses the same
  // work-keyed equipment layers instead of the fixed per-unit-type set. A
  // promoted chief looks up equipment by 'Chief' rather than its original
  // unit.type, since that's the only place it still carries its old type.
  const corpseEquipment = getCorpseAppearanceEquipment(unit)
  const baseLayers = (
    corpseEquipment
      ? dynamicEquipmentLayersForEquipment(corpseEquipment)
      : isVillagerLike
        ? dynamicEquipmentLayersForVillager()
        : dynamicEquipmentLayersForUnit(resolvedBakedUnit === 'chief' ? UNIT_TYPES.chief : unit.type, unit.owner?.civ)
  ).filter(layer => !isDefaultHeroWeaponLayer(layer, unit) && !isLayerReplacedByActiveWeapon(layer, unit))
  const equippedLayers = dynamicEquipmentLayersForEquipment(getInventoryAppearanceEquipment(unit))
  const dynamicLayers = [
    ...(resolvedBakedUnit === 'hero' && unit.owner ? heroAppearanceLayersForPlayer(unit.owner) : []),
    ...baseLayers,
    ...equippedLayers,
  ]
  unit.appearance = dynamicLayers.length ? { layers: dynamicLayers } : undefined

  if (!isVillagerLike) {
    const actionSheet =
      unit.type === UNIT_TYPES.bowman
        ? bakedUnitActionAlias(resolvedBakedUnit, variant, 'shoot')
        : bakedUnitAlias(resolvedBakedUnit, variant, 'action')
    unit.assets = {
      standingSheet: walking,
      walkingSheet: walking,
      actionSheet,
      dyingSheet: bakedUnitAlias(resolvedBakedUnit, variant, 'dying'),
      corpseSheet: bakedUnitAlias(resolvedBakedUnit, variant, 'corpse'),
    }
    return true
  }

  const actionAlias = resolvedBakedUnit === 'hero' ? heroActionAlias : villagerActionAlias
  const villagerSheets = (actionAnimation: 'slash' | 'shoot') => {
    const bodyWalking = bodyAlias(variant, 'walking')
    const bodyDying = bodyAlias(variant, 'dying')
    const bodyCorpse = bodyAlias(variant, 'corpse')
    const sheets = {
      standingSheet: bodyWalking,
      walkingSheet: bodyWalking,
      actionSheet: actionAlias(variant, actionAnimation),
      dyingSheet: bodyDying,
      corpseSheet: bodyCorpse,
    }
    return sheets
  }

  unit.allAssets = {
    default: villagerSheets('slash'),
    attacker: villagerSheets('slash'),
    heroSword: villagerSheets('slash'),
    hunter: {
      ...villagerSheets('shoot'),
      harvestSheet: actionAlias(variant, 'slash'),
    },
    horseCapture: {
      ...villagerSheets('slash'),
      harvestSheet: actionAlias(variant, 'slash'),
    },
    farmer: villagerSheets('slash'),
    forager: villagerSheets('slash'),
    stoneminer: villagerSheets('slash'),
    goldminer: villagerSheets('slash'),
    woodcutter: villagerSheets('slash'),
    builder: villagerSheets('slash'),
  }
  unit.assets = unit.allAssets.default
  return true
}

export function refreshBakedLpcUnitAssets(unit: UnitEntity): boolean {
  if (!applyBakedLpcUnitAssets(unit)) return false
  Object.assign(
    unit,
    Object.fromEntries(Object.entries(unit.assets ?? {}).map(([key, value]) => [key, Assets.cache.get(value)]))
  )
  unit.setTextures?.(unit.currentSheet ?? SHEET_TYPES.standing)
  return true
}

export async function ensureAndRefreshBakedLpcUnitAssets(unit: UnitEntity): Promise<boolean> {
  const resolvedBakedUnit = resolveBakedUnitForRuntime(unit)
  const variant = resolvedBakedUnit ? resolveBakedRuntimeVariant(unit, resolvedBakedUnit) : null
  if (!resolvedBakedUnit || !variant) return false
  await loadBakedUnitVariant(resolvedBakedUnit, variant)
  return refreshBakedLpcUnitAssets(unit)
}
