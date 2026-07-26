import { Assets } from 'pixi.js'
import { hashLpcAppearanceSeed } from './appearance'
import { dynamicEquipmentAssets, dynamicEquipmentLayersForUnit, dynamicEquipmentLayersForVillager } from './equipment'
import type { UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

const BAKED_LPC_BASE_URL = 'assets/graphics/lpc-baked'
const BAKED_LPC_ALIAS_PREFIX = 'lpc-baked'
const BAKED_VARIANT_KEYS = ['01'] as const

const UNIT_SHEETS = ['walking', 'action', 'riding', 'dying', 'corpse'] as const
const VILLAGER_BODY_SHEETS = ['walking', 'dying', 'corpse'] as const
const VILLAGER_ACTION_SHEETS = ['slash', 'thrust', 'shoot'] as const

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
  | 'hero'

const UNIT_TYPE_TO_BAKED_UNIT: Partial<Record<string, BakedUnitType>> = {
  Villager: 'villager',
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

function villagerBodyAlias(variant: string, sheet: string): string {
  return bakedAlias('villager', variant, 'body', sheet)
}

function villagerActionAlias(variant: string, animation: string): string {
  return bakedAlias('villager', variant, 'action', animation)
}

// The hero bakes the same "body" + "action" (slash/thrust/shoot) layout as the
// villager (see hero_build_tasks() in scripts/lpc/build.py), plus a mounted
// "riding" sheet under the same "action" folder.
function heroBodyAlias(variant: string, sheet: string): string {
  return bakedAlias('hero', variant, 'body', sheet)
}

function heroActionAlias(variant: string, animation: string): string {
  return bakedAlias('hero', variant, 'action', animation)
}

const HERO_ACTION_SHEETS = [...VILLAGER_ACTION_SHEETS, 'riding'] as const

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

  const assets = (['default'] as const)
    .flatMap(job => UNIT_SHEETS.map(sheet => ({ job, sheet })))
    .map(({ job, sheet }) => ({
      alias: bakedAlias(unit, variant, job, sheet),
      src: bakedSrc(unit, variant, job, sheet),
    }))
    .filter(asset => !Assets.cache.get(asset.alias))

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
  // The ARPG hero keeps unit.type === 'Villager' (same stats/economy jobs), only
  // its look is swapped — so it's selected by controlMode, not by unit.type like
  // every other baked unit.
  const bakedUnit: BakedUnitType | undefined = unit.controlMode === 'hero' ? 'hero' : UNIT_TYPE_TO_BAKED_UNIT[unit.type]
  if (!bakedUnit || !unit.owner) return false

  const variant = bakedVariantKey(unit.owner, `${unit.owner.label}:${unit.label}:${unit.i}:${unit.j}`)
  const isVillagerLike = bakedUnit === 'villager' || bakedUnit === 'hero'
  const bodyAlias = bakedUnit === 'hero' ? heroBodyAlias : villagerBodyAlias
  const walking = isVillagerLike ? bodyAlias(variant, 'walking') : bakedAlias(bakedUnit, variant, 'default', 'walking')
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
  // work-keyed equipment layers instead of the fixed per-unit-type set.
  const dynamicLayers = isVillagerLike ? dynamicEquipmentLayersForVillager() : dynamicEquipmentLayersForUnit(unit.type)
  unit.appearance = dynamicLayers.length ? { layers: dynamicLayers } : undefined

  if (!isVillagerLike) {
    unit.assets = {
      standingSheet: walking,
      walkingSheet: walking,
      actionSheet: bakedAlias(bakedUnit, variant, 'default', 'action'),
      ridingSheet: bakedAlias(bakedUnit, variant, 'default', 'riding'),
      dyingSheet: bakedAlias(bakedUnit, variant, 'default', 'dying'),
      corpseSheet: bakedAlias(bakedUnit, variant, 'default', 'corpse'),
    }
    return true
  }

  const actionAlias = bakedUnit === 'hero' ? heroActionAlias : villagerActionAlias
  const villagerSheets = (actionAnimation: 'slash' | 'thrust' | 'shoot') => {
    const bodyWalking = bodyAlias(variant, 'walking')
    const bodyDying = bodyAlias(variant, 'dying')
    const bodyCorpse = bodyAlias(variant, 'corpse')
    return {
      standingSheet: bodyWalking,
      walkingSheet: bodyWalking,
      actionSheet: actionAlias(variant, actionAnimation),
      dyingSheet: bodyDying,
      corpseSheet: bodyCorpse,
    }
  }

  unit.allAssets = {
    default: villagerSheets('slash'),
    attacker: villagerSheets('slash'),
    hunter: {
      ...villagerSheets('shoot'),
      harvestSheet: actionAlias(variant, 'slash'),
      loadedSheet: bodyAlias(variant, 'walking'),
    },
    fisher: { ...villagerSheets('thrust'), loadedSheet: bodyAlias(variant, 'walking') },
    farmer: { ...villagerSheets('slash'), loadedSheet: bodyAlias(variant, 'walking') },
    forager: { ...villagerSheets('slash'), loadedSheet: bodyAlias(variant, 'walking') },
    stoneminer: { ...villagerSheets('slash'), loadedSheet: bodyAlias(variant, 'walking') },
    goldminer: { ...villagerSheets('slash'), loadedSheet: bodyAlias(variant, 'walking') },
    woodcutter: { ...villagerSheets('slash'), loadedSheet: bodyAlias(variant, 'walking') },
    builder: villagerSheets('slash'),
  }
  unit.assets = bakedUnit === 'hero' ? { ...unit.allAssets.default, ridingSheet: actionAlias(variant, 'riding') } : unit.allAssets.default
  return true
}
