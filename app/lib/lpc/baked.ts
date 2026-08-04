import { Assets } from 'pixi.js'
import { hashLpcAppearanceSeed } from './appearance'
import { dynamicEquipmentAssets, dynamicEquipmentLayersForUnit, dynamicEquipmentLayersForVillager } from './equipment'
import { isChiefUnit } from '../chief'
import { UNIT_TYPES } from '../../constants'
import type { UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

const BAKED_LPC_BASE_URL = 'assets/graphics/lpc-baked'
const BAKED_LPC_ALIAS_PREFIX = 'lpc-baked'
const BAKED_VARIANT_KEYS = ['01'] as const

const UNIT_SHEETS = ['walking', 'action', 'riding', 'dying', 'corpse'] as const
const VILLAGER_BODY_SHEETS = ['walking', 'dying', 'corpse'] as const
const VILLAGER_ACTION_SHEETS = ['slash', 'shoot'] as const
const HERO_BASE_ACTION_SHEETS = ['slash', 'shoot'] as const

type BakedUnitType =
  | 'villager'
  | 'clubman'
  | 'axeman'
  | 'bowman'
  | 'shortswordman'
  | 'improvedbowman'
  | 'compositebowman'
  | 'broadswordman'
  | 'longswordman'
  | 'hoplite'
  | 'phalanx'
  | 'priest'
  | 'chief'
  | 'hero'

const UNIT_TYPE_TO_BAKED_UNIT: Partial<Record<string, BakedUnitType>> = {
  Hero: 'hero',
  Villager: 'villager',
  Chief: 'chief',
  Clubman: 'clubman',
  Axeman: 'axeman',
  Bowman: 'bowman',
  ShortSwordsman: 'shortswordman',
  ImprovedBowman: 'improvedbowman',
  CompositeBowman: 'compositebowman',
  BroadSwordsman: 'broadswordman',
  LongSwordsman: 'longswordman',
  Legion: 'longswordman',
  Hoplite: 'hoplite',
  Phalanx: 'phalanx',
  Centurion: 'phalanx',
  Priest: 'priest',
}

function civKey(civilization: string | null | undefined): string {
  return (civilization || 'Greek').toLowerCase()
}

function variantIndex(seed: string): string {
  return BAKED_VARIANT_KEYS[Math.abs(hashLpcAppearanceSeed(seed)) % BAKED_VARIANT_KEYS.length]
}

// Every recolorable piece is baked in the same "blue" team-color convention (see
// scripts/lpc/build.py) and repainted at runtime by changeSpriteColor, so the baked
// variant only depends on civ, never on the player's color.
function bakedVariantKey(owner: Pick<PlayerLike, 'civ' | 'label'>, seed: string): string {
  return `${civKey(owner.civ)}_${variantIndex(seed)}`
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
export function getBakedUnitStandingSheetAlias(type: string, owner: Pick<PlayerLike, 'civ' | 'label'>): string | null {
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

const HERO_RIDING_ACTION_SHEETS = HERO_BASE_ACTION_SHEETS.map(sheet => `riding/${sheet}`) as readonly string[]
const HERO_ACTION_SHEETS = [...HERO_BASE_ACTION_SHEETS, ...HERO_RIDING_ACTION_SHEETS] as const

async function loadBakedUnitVariant(unit: BakedUnitType, variant: string): Promise<void> {
  if (unit === 'villager' || unit === 'hero') {
    const bodyAlias = unit === 'hero' ? heroBodyAlias : villagerBodyAlias
    const actionAlias = unit === 'hero' ? heroActionAlias : villagerActionAlias
    const actionSheets: readonly string[] = unit === 'hero' ? HERO_ACTION_SHEETS : VILLAGER_ACTION_SHEETS
    const assets = [
      ...VILLAGER_BODY_SHEETS.map(sheet => ({
        alias: bodyAlias(variant, sheet),
        src: bakedSrc(unit, variant, 'body', sheet),
      })),
      ...actionSheets.map(sheet => ({
        alias: actionAlias(variant, sheet),
        src: bakedSrc(unit, variant, 'action', sheet),
      })),
    ].filter(asset => !Assets.cache.get(asset.alias))

    if (assets.length) {
      await Assets.load(assets)
    }
    return
  }

  const assets = UNIT_SHEETS.map(sheet => ({
    alias: bakedUnitAlias(unit, variant, sheet),
    src: bakedUnitSrc(unit, variant, sheet),
  })).filter(asset => !Assets.cache.get(asset.alias))

  if (assets.length) {
    await Assets.load(assets)
  }
}

// 'hero' isn't in UNIT_TYPE_TO_BAKED_UNIT (it's not selected by unit.type — see
// applyBakedLpcUnitAssets), so it's added here explicitly to still get preloaded.
const BAKED_UNITS: readonly BakedUnitType[] = [
  ...new Set(Object.values(UNIT_TYPE_TO_BAKED_UNIT)),
  'hero',
] as BakedUnitType[]

export async function preloadBakedLpcUnitsForPlayers(players: Pick<PlayerLike, 'civ' | 'label'>[]): Promise<void> {
  const variants = new Set<string>()
  for (const player of players) {
    for (const variantKey of BAKED_VARIANT_KEYS) {
      const variant = `${civKey(player.civ)}_${variantKey}`
      for (const bakedUnit of BAKED_UNITS) {
        variants.add(`${bakedUnit}:${variant}`)
      }
    }
  }

  await Promise.all(
    [...variants].map(entry => {
      const [unit, variant] = entry.split(':') as [BakedUnitType, string]
      return loadBakedUnitVariant(unit, variant)
    })
  )

  const equipmentAssets = dynamicEquipmentAssets().filter(asset => !Assets.cache.get(asset.alias))
  if (equipmentAssets.length) {
    await Assets.load(equipmentAssets)
  }
}

export function applyBakedLpcUnitAssets(unit: UnitEntity): boolean {
  // The player-controlled hero has its own config, but controlMode still wins here
  // because a promoted chief and a controlled hero can both be isChief units.
  const bakedUnit: BakedUnitType | undefined =
    unit.controlMode === 'hero' ? 'hero' : isChiefUnit(unit) ? 'chief' : UNIT_TYPE_TO_BAKED_UNIT[unit.type]
  if (!bakedUnit || !unit.owner) return false

  const variant = bakedVariantKey(unit.owner, `${unit.owner.label}:${unit.label}:${unit.i}:${unit.j}`)
  const isVillagerLike = bakedUnit === 'villager' || bakedUnit === 'hero'
  const bodyAlias = bakedUnit === 'hero' ? heroBodyAlias : villagerBodyAlias
  const walking = isVillagerLike ? bodyAlias(variant, 'walking') : bakedUnitAlias(bakedUnit, variant, 'walking')
  if (!Assets.cache.get(walking)) return false

  unit.appearance = undefined
  unit.spriteScale = 0.8
  unit.appearanceVariants = undefined
  unit.sheetDirectionCounts = {
    standingSheet: 3,
    walkingSheet: 3,
    actionSheet: 3,
    ridingSheet: 3,
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
    : dynamicEquipmentLayersForUnit(bakedUnit === 'chief' ? UNIT_TYPES.chief : unit.type)
  unit.appearance = dynamicLayers.length ? { layers: dynamicLayers } : undefined

  if (!isVillagerLike) {
    unit.assets = {
      standingSheet: walking,
      walkingSheet: walking,
      actionSheet: bakedUnitAlias(bakedUnit, variant, 'action'),
      ridingSheet: bakedUnitAlias(bakedUnit, variant, 'riding'),
      dyingSheet: bakedUnitAlias(bakedUnit, variant, 'dying'),
      corpseSheet: bakedUnitAlias(bakedUnit, variant, 'corpse'),
    }
    return true
  }

  const actionAlias = bakedUnit === 'hero' ? heroActionAlias : villagerActionAlias
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
    return bakedUnit === 'hero' ? { ...sheets, ridingSheet: actionAlias(variant, `riding/${actionAnimation}`) } : sheets
  }

  unit.allAssets = {
    default: villagerSheets('slash'),
    attacker: villagerSheets('slash'),
    heroSword: villagerSheets('slash'),
    heroSpear: villagerSheets('slash'),
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
