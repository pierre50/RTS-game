import { Assets } from 'pixi.js'
import { hashLpcAppearanceSeed } from './appearance'
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

const JOB_SHEETS = ['walking', 'action', 'dying', 'corpse'] as const

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
}

function civKey(civilization: string | null | undefined): string {
  return (civilization || 'Greek').toLowerCase()
}

function playerColorKey(color: string | null | undefined): string {
  return color || 'blue'
}

function variantIndex(seed: string): string {
  return BAKED_VARIANT_KEYS[Math.abs(hashLpcAppearanceSeed(seed)) % BAKED_VARIANT_KEYS.length]
}

function bakedVariantKey(unit: BakedUnitType, owner: Pick<PlayerLike, 'civ' | 'color' | 'label'>, seed: string): string {
  const base = `${civKey(owner.civ)}_${variantIndex(seed)}`
  return unit === 'villager' ? `${base}_${playerColorKey(owner.color)}` : base
}

function bakedAlias(unit: BakedUnitType, variant: string, job: string, sheet: string): string {
  return `${BAKED_LPC_ALIAS_PREFIX}/${unit}/${variant}/${job}/${sheet}`
}

function bakedSrc(unit: BakedUnitType, variant: string, job: string, sheet: string): string {
  return `${BAKED_LPC_BASE_URL}/${unit}/${variant}/${job}/${sheet}/texture.json`
}

async function loadBakedUnitVariant(unit: BakedUnitType, variant: string): Promise<void> {
  const jobs = unit === 'villager' ? VILLAGER_JOBS : (['default'] as const)
  const assets = jobs
    .flatMap(job => JOB_SHEETS.map(sheet => ({ job, sheet })))
    .map(({ job, sheet }) => ({
      alias: bakedAlias(unit, variant, job, sheet),
      src: bakedSrc(unit, variant, job, sheet),
    }))
    .filter(asset => !Assets.cache.get(asset.alias))

  if (assets.length) {
    await Assets.load(assets)
  }
}

export async function preloadBakedLpcUnitsForPlayers(players: Pick<PlayerLike, 'civ' | 'color' | 'label'>[]): Promise<void> {
  const variants = new Set<string>()
  for (const player of players) {
    for (const variantKey of BAKED_VARIANT_KEYS) {
      variants.add(`villager:${civKey(player.civ)}_${variantKey}_${playerColorKey(player.color)}`)
      variants.add(`clubman:${civKey(player.civ)}_${variantKey}`)
      variants.add(`axeman:${civKey(player.civ)}_${variantKey}`)
      variants.add(`bowman:${civKey(player.civ)}_${variantKey}`)
      variants.add(`shortswordman:${civKey(player.civ)}_${variantKey}`)
      variants.add(`improvedbowman:${civKey(player.civ)}_${variantKey}`)
      variants.add(`compositebowman:${civKey(player.civ)}_${variantKey}`)
      variants.add(`broadswordman:${civKey(player.civ)}_${variantKey}`)
      variants.add(`longswordman:${civKey(player.civ)}_${variantKey}`)
    }
  }

  await Promise.all(
    [...variants].map(entry => {
      const [unit, variant] = entry.split(':') as [BakedUnitType, string]
      return loadBakedUnitVariant(unit, variant)
    })
  )
}

export function applyBakedLpcUnitAssets(unit: UnitEntity): boolean {
  const bakedUnit = UNIT_TYPE_TO_BAKED_UNIT[unit.type]
  if (!bakedUnit || !unit.owner) return false

  const variant = bakedVariantKey(bakedUnit, unit.owner, `${unit.owner.label}:${unit.label}:${unit.i}:${unit.j}`)
  const walking = bakedAlias(bakedUnit, variant, 'default', 'walking')
  if (!Assets.cache.get(walking)) return false

  unit.appearance = undefined
  unit.appearanceVariants = undefined
  unit.spriteScale = 0.5
  unit.sheetDirectionCounts = {
    standingSheet: 4,
    walkingSheet: 4,
    actionSheet: 4,
    harvestSheet: 4,
    loadedSheet: 4,
    dyingSheet: 1,
    corpseSheet: 1,
  }

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

  const villagerSheets = (job: VillagerJob) => {
    const jobWalking = bakedAlias(bakedUnit, variant, job, 'walking')
    return {
      standingSheet: jobWalking,
      walkingSheet: jobWalking,
      actionSheet: bakedAlias(bakedUnit, variant, job, 'action'),
      dyingSheet: bakedAlias(bakedUnit, variant, job, 'dying'),
      corpseSheet: bakedAlias(bakedUnit, variant, job, 'corpse'),
    }
  }

  unit.allAssets = {
    default: villagerSheets('default'),
    attacker: villagerSheets('attacker'),
    hunter: { ...villagerSheets('hunter'), harvestSheet: bakedAlias(bakedUnit, variant, 'hunter', 'action') },
    fisher: { ...villagerSheets('fisher'), loadedSheet: bakedAlias(bakedUnit, variant, 'fisher', 'walking') },
    farmer: { ...villagerSheets('farmer'), loadedSheet: bakedAlias(bakedUnit, variant, 'farmer', 'walking') },
    forager: { ...villagerSheets('forager'), loadedSheet: bakedAlias(bakedUnit, variant, 'forager', 'walking') },
    stoneminer: { ...villagerSheets('stoneminer'), loadedSheet: bakedAlias(bakedUnit, variant, 'stoneminer', 'walking') },
    goldminer: { ...villagerSheets('goldminer'), loadedSheet: bakedAlias(bakedUnit, variant, 'goldminer', 'walking') },
    woodcutter: { ...villagerSheets('woodcutter'), loadedSheet: bakedAlias(bakedUnit, variant, 'woodcutter', 'walking') },
    builder: villagerSheets('builder'),
  }
  unit.assets = unit.allAssets.default
  return true
}
