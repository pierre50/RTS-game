import { Assets } from 'pixi.js'
import { hashLpcAppearanceSeed } from './appearance'
import { dynamicEquipmentAssets, dynamicEquipmentLayersForUnit, dynamicEquipmentLayersForVillager } from './equipment'
import type { UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

const BAKED_LPC_BASE_URL = 'assets/graphics/lpc-baked'
const BAKED_LPC_ALIAS_PREFIX = 'lpc-baked'
const BAKED_VARIANT_KEYS = ['01'] as const

const VILLAGER_JOBS = [
  'default',
  'attacker',
  'forager',
  'woodcutter',
  'stoneminer',
  'goldminer',
  'builder',
  'farmer',
  'hunter',
  'fisher',
] as const

const UNIT_SHEETS = ['walking', 'action', 'dying', 'corpse'] as const
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
type VillagerJob = (typeof VILLAGER_JOBS)[number]

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

async function loadBakedUnitVariant(unit: BakedUnitType, variant: string): Promise<void> {
  if (unit === 'villager') {
    const assets = [
      ...VILLAGER_BODY_SHEETS.map(sheet => ({
        alias: villagerBodyAlias(variant, sheet),
        src: bakedSrc(unit, variant, 'body', sheet),
      })),
      ...VILLAGER_ACTION_SHEETS.map(sheet => ({
        alias: villagerActionAlias(variant, sheet),
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

const BAKED_UNITS: readonly BakedUnitType[] = [...new Set(Object.values(UNIT_TYPE_TO_BAKED_UNIT))] as BakedUnitType[]

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
  const bakedUnit = UNIT_TYPE_TO_BAKED_UNIT[unit.type]
  if (!bakedUnit || !unit.owner) return false

  const variant = bakedVariantKey(unit.owner, `${unit.owner.label}:${unit.label}:${unit.i}:${unit.j}`)
  const walking = bakedUnit === 'villager' ? villagerBodyAlias(variant, 'walking') : bakedAlias(bakedUnit, variant, 'default', 'walking')
  if (!Assets.cache.get(walking)) return false

  unit.appearance = undefined
  unit.spriteScale = 0.8
  unit.appearanceVariants = undefined
  unit.sheetDirectionCounts = {
    standingSheet: 3,
    walkingSheet: 3,
    actionSheet: 3,
    harvestSheet: 3,
    loadedSheet: 3,
    dyingSheet: 1,
    corpseSheet: 1,
  }

  const dynamicLayers = bakedUnit === 'villager' ? dynamicEquipmentLayersForVillager() : dynamicEquipmentLayersForUnit(unit.type)
  unit.appearance = dynamicLayers.length ? { layers: dynamicLayers } : undefined

  if (bakedUnit !== 'villager') {
    unit.assets = {
      standingSheet: walking,
      walkingSheet: walking,
      actionSheet: bakedAlias(bakedUnit, variant, 'default', 'action'),
      dyingSheet: bakedAlias(bakedUnit, variant, 'default', 'dying'),
      corpseSheet: bakedAlias(bakedUnit, variant, 'default', 'corpse'),
    }
    return true
  }

  const villagerSheets = (actionAnimation: 'slash' | 'thrust' | 'shoot') => {
    const bodyWalking = villagerBodyAlias(variant, 'walking')
    const bodyDying = villagerBodyAlias(variant, 'dying')
    const bodyCorpse = villagerBodyAlias(variant, 'corpse')
    return {
      standingSheet: bodyWalking,
      walkingSheet: bodyWalking,
      actionSheet: villagerActionAlias(variant, actionAnimation),
      dyingSheet: bodyDying,
      corpseSheet: bodyCorpse,
    }
  }

  unit.allAssets = {
    default: villagerSheets('slash'),
    attacker: villagerSheets('slash'),
    hunter: {
      ...villagerSheets('shoot'),
      harvestSheet: villagerActionAlias(variant, 'slash'),
      loadedSheet: villagerBodyAlias(variant, 'walking'),
    },
    fisher: { ...villagerSheets('thrust'), loadedSheet: villagerBodyAlias(variant, 'walking') },
    farmer: { ...villagerSheets('slash'), loadedSheet: villagerBodyAlias(variant, 'walking') },
    forager: { ...villagerSheets('slash'), loadedSheet: villagerBodyAlias(variant, 'walking') },
    stoneminer: { ...villagerSheets('slash'), loadedSheet: villagerBodyAlias(variant, 'walking') },
    goldminer: { ...villagerSheets('slash'), loadedSheet: villagerBodyAlias(variant, 'walking') },
    woodcutter: { ...villagerSheets('slash'), loadedSheet: villagerBodyAlias(variant, 'walking') },
    builder: villagerSheets('slash'),
  }
  unit.assets = unit.allAssets.default
  return true
}
