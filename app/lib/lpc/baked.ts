import { Assets } from 'pixi.js'
import { hashLpcAppearanceSeed } from './appearance'
import { dynamicEquipmentAssets, dynamicEquipmentLayersForUnit, dynamicEquipmentLayersForVillager } from './equipment'
import { isChiefUnit } from '../chief'
import { getUnitEquipmentLevel } from '../unitExperience'
import { SHEET_TYPES, UNIT_TYPES } from '../../constants'
import type { UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

const BAKED_LPC_BASE_URL = 'assets/graphics/lpc-baked'
const BAKED_LPC_ALIAS_PREFIX = 'lpc-baked'
const BAKED_GENDERS = ['male', 'female'] as const

const UNIT_SHEETS = ['walking', 'action', 'dying', 'corpse'] as const
const VILLAGER_BODY_SHEETS = ['walking', 'dying', 'corpse'] as const
const VILLAGER_ACTION_SHEETS = ['slash', 'shoot'] as const
const HERO_BASE_ACTION_SHEETS = ['slash', 'shoot'] as const

type BakedUnitType =
  | 'villager'
  | 'infantry'
  | 'infantry_nohair'
  | 'priest'
  | 'chief'
  | 'hero'

const INFANTRY_HELMET_MIN_LEVEL = 6

const UNIT_TYPE_TO_BAKED_UNIT: Partial<Record<string, BakedUnitType>> = {
  Hero: 'hero',
  Villager: 'villager',
  Chief: 'chief',
  Fantassin: 'infantry',
  Bowman: 'infantry',
  Priest: 'priest',
}

function civKey(civilization: string | null | undefined): string {
  return (civilization || 'Greek').toLowerCase()
}

function genderKey(seed: string, preferredGender?: string | null): string {
  if (preferredGender === 'male' || preferredGender === 'female') return preferredGender
  return BAKED_GENDERS[Math.abs(hashLpcAppearanceSeed(seed)) % BAKED_GENDERS.length]
}

// Every recolorable piece is baked in the same "blue" team-color convention (see
// scripts/lpc/build.py) and repainted at runtime by changeSpriteColor, so the baked
// variant only depends on civ, never on the player's color.
function bakedVariantKey(
  owner: Pick<PlayerLike, 'civ' | 'gender' | 'label'>,
  seed: string,
  preferredGender?: string | null
): string {
  return `${civKey(owner.civ)}/${genderKey(seed, preferredGender)}`
}

function bakedAlias(unit: BakedUnitType, variant: string, job: string, sheet: string): string {
  return `${BAKED_LPC_ALIAS_PREFIX}/${unit}/${variant}/${job}/${sheet}`
}

function bakedSrc(unit: BakedUnitType, variant: string, job: string, sheet: string): string {
  return `${BAKED_LPC_BASE_URL}/${unit}/${variant}/${job}/${sheet}/texture.json`
}

function bakedUnitAlias(unit: BakedUnitType, variant: string, sheet: string): string {
  return `${BAKED_LPC_ALIAS_PREFIX}/${unit}/${variant}/${sheet}`
}

function bakedUnitSrc(unit: BakedUnitType, variant: string, sheet: string): string {
  return `${BAKED_LPC_BASE_URL}/${unit}/${variant}/${sheet}/texture.json`
}

function villagerBodyAlias(variant: string, sheet: string): string {
  return bakedAlias('villager', variant, 'body', sheet)
}

function villagerActionAlias(variant: string, animation: string): string {
  return bakedAlias('villager', variant, 'action', animation)
}

// The hero bakes the villager-style "body" layout, plus the action poses it can still use directly.
function heroBodyAlias(variant: string, sheet: string): string {
  return bakedAlias('hero', variant, 'body', sheet)
}

function heroActionAlias(variant: string, animation: string): string {
  return bakedAlias('hero', variant, 'action', animation)
}

// Resolves the baked walking/standing sheet alias for a unit TYPE (not a live
// instance) — used for previews (e.g. training-button portraits) where there's
// no UnitEntity yet to read appearance off of.
export function getBakedUnitStandingSheetAlias(
  type: string,
  owner: Pick<PlayerLike, 'civ' | 'gender' | 'label'>
): string | null {
  const bakedUnit = UNIT_TYPE_TO_BAKED_UNIT[type]
  if (!bakedUnit) return null

  const variant = bakedVariantKey(owner, type)
  const isVillagerLike = bakedUnit === 'villager' || bakedUnit === 'hero'
  if (isVillagerLike) {
    const bodyAlias = bakedUnit === 'hero' ? heroBodyAlias : villagerBodyAlias
    return bodyAlias(variant, 'walking')
  }
  return bakedUnitAlias(bakedUnit, variant, 'walking')
}

function isAssetCached(alias: string): boolean {
  return Assets.cache.has(alias)
}

async function loadBakedUnitVariant(unit: BakedUnitType, variant: string): Promise<void> {
  if (unit === 'villager' || unit === 'hero') {
    const bodyAlias = unit === 'hero' ? heroBodyAlias : villagerBodyAlias
    const actionAlias = unit === 'hero' ? heroActionAlias : villagerActionAlias
    const actionSheets: readonly string[] = unit === 'hero' ? HERO_BASE_ACTION_SHEETS : VILLAGER_ACTION_SHEETS
    const assets = [
      ...VILLAGER_BODY_SHEETS.map(sheet => ({
        alias: bodyAlias(variant, sheet),
        src: bakedSrc(unit, variant, 'body', sheet),
      })),
      ...actionSheets.map(sheet => ({
        alias: actionAlias(variant, sheet),
        src: bakedSrc(unit, variant, 'action', sheet),
      })),
    ].filter(asset => !isAssetCached(asset.alias))

    if (assets.length) {
      await Assets.load(assets)
    }
    return
  }

  const assets = UNIT_SHEETS.map(sheet => ({
    alias: bakedUnitAlias(unit, variant, sheet),
    src: bakedUnitSrc(unit, variant, sheet),
  })).filter(asset => !isAssetCached(asset.alias))

  if (assets.length) {
    await Assets.load(assets)
  }
}

// 'hero' isn't in UNIT_TYPE_TO_BAKED_UNIT (it's not selected by unit.type — see
// applyBakedLpcUnitAssets), so it's added here explicitly to still get preloaded.
const BAKED_UNITS: readonly BakedUnitType[] = [
  ...new Set(Object.values(UNIT_TYPE_TO_BAKED_UNIT)),
  'infantry_nohair',
  'hero',
] as BakedUnitType[]

function resolveBakedUnitForRuntime(unit: UnitEntity): BakedUnitType | undefined {
  const bakedUnit: BakedUnitType | undefined =
    unit.controlMode === 'hero' ? 'hero' : isChiefUnit(unit) ? 'chief' : UNIT_TYPE_TO_BAKED_UNIT[unit.type]
  if (bakedUnit !== 'infantry' || ![UNIT_TYPES.infantry, UNIT_TYPES.bowman].includes(unit.type)) return bakedUnit
  return getUnitEquipmentLevel(unit) >= INFANTRY_HELMET_MIN_LEVEL ? 'infantry_nohair' : 'infantry'
}

function resolveBakedRuntimeVariant(unit: UnitEntity, bakedUnit: BakedUnitType): string | null {
  if (!unit.owner) return null
  const preferredGender = unit.appearanceVariants?.gender ?? (bakedUnit === 'hero' ? unit.owner.gender : null)
  return bakedVariantKey(unit.owner, `${unit.owner.label}:${unit.label}:${unit.i}:${unit.j}`, preferredGender)
}

export async function preloadBakedLpcUnitsForPlayers(players: Pick<PlayerLike, 'civ' | 'gender' | 'label'>[]): Promise<void> {
  const variants = new Set<string>()
  for (const player of players) {
    for (const gender of BAKED_GENDERS) {
      const variant = `${civKey(player.civ)}/${gender}`
      for (const bakedUnit of BAKED_UNITS) {
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
}

export function applyBakedLpcUnitAssets(unit: UnitEntity): boolean {
  // The player-controlled hero has its own config, but controlMode still wins here
  // because a promoted chief and a controlled hero can both be isChief units.
  const resolvedBakedUnit = resolveBakedUnitForRuntime(unit)
  const variant = resolvedBakedUnit ? resolveBakedRuntimeVariant(unit, resolvedBakedUnit) : null
  if (!resolvedBakedUnit || !variant) return false

  // Player setup gender only drives the controlled hero/avatar. Regular units
  // keep a spawn-time mix so a batch like "spawn villager 10" is visually varied.
  const gender = variant.endsWith('/female') ? 'female' : 'male'
  const isVillagerLike = resolvedBakedUnit === 'villager' || resolvedBakedUnit === 'hero'
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
    loadedSheet: 3,
    dyingSheet: 1,
    corpseSheet: 1,
  }

  // The hero keeps swapping tools (axe/pickaxe/bow/...) exactly like a villager
  // does — that's driven by unit.work, not by unit.type — so it reuses the same
  // work-keyed equipment layers instead of the fixed per-unit-type set. A
  // promoted chief looks up equipment by 'Chief' rather than its original
  // unit.type, since that's the only place it still carries its old type.
  const dynamicLayers = isVillagerLike
    ? dynamicEquipmentLayersForVillager()
    : dynamicEquipmentLayersForUnit(resolvedBakedUnit === 'chief' ? UNIT_TYPES.chief : unit.type)
  unit.appearance = dynamicLayers.length ? { layers: dynamicLayers } : undefined

  if (!isVillagerLike) {
    unit.assets = {
      standingSheet: walking,
      walkingSheet: walking,
      actionSheet: bakedUnitAlias(resolvedBakedUnit, variant, 'action'),
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
      loadedSheet: bodyAlias(variant, 'walking'),
    },
    farmer: { ...villagerSheets('slash'), loadedSheet: bodyAlias(variant, 'walking') },
    forager: { ...villagerSheets('slash'), loadedSheet: bodyAlias(variant, 'walking') },
    stoneminer: { ...villagerSheets('slash'), loadedSheet: bodyAlias(variant, 'walking') },
    goldminer: { ...villagerSheets('slash'), loadedSheet: bodyAlias(variant, 'walking') },
    woodcutter: { ...villagerSheets('slash'), loadedSheet: bodyAlias(variant, 'walking') },
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
