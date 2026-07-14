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
// Jobs whose "loaded" pose is its own bake (carrying a resource-specific item) rather
// than a reuse of another job's "walking" bake — see hunter's `loaded_equipment` in
// scripts/lpc/jobs.py.
const EXTRA_JOB_SHEETS: Partial<Record<VillagerJob, readonly string[]>> = {
  hunter: ['loaded'],
  stoneminer: ['loaded'],
  goldminer: ['loaded'],
}

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
  Hoplite: 'hoplite',
  Phalanx: 'phalanx',
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

async function loadBakedUnitVariant(unit: BakedUnitType, variant: string): Promise<void> {
  const jobs = unit === 'villager' ? VILLAGER_JOBS : (['default'] as const)
  const assets = jobs
    .flatMap(job => [
      ...JOB_SHEETS.map(sheet => ({ job, sheet })),
      ...(EXTRA_JOB_SHEETS[job as VillagerJob] ?? []).map(sheet => ({ job, sheet })),
    ])
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
}

export function applyBakedLpcUnitAssets(unit: UnitEntity): boolean {
  const bakedUnit = UNIT_TYPE_TO_BAKED_UNIT[unit.type]
  if (!bakedUnit || !unit.owner) return false

  const variant = bakedVariantKey(unit.owner, `${unit.owner.label}:${unit.label}:${unit.i}:${unit.j}`)
  const walking = bakedAlias(bakedUnit, variant, 'default', 'walking')
  if (!Assets.cache.get(walking)) return false

  unit.appearance = undefined
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
    hunter: {
      ...villagerSheets('hunter'),
      harvestSheet: bakedAlias(bakedUnit, variant, 'forager', 'action'),
      loadedSheet: bakedAlias(bakedUnit, variant, 'hunter', 'loaded'),
    },
    fisher: { ...villagerSheets('fisher'), loadedSheet: bakedAlias(bakedUnit, variant, 'fisher', 'walking') },
    farmer: { ...villagerSheets('farmer'), loadedSheet: bakedAlias(bakedUnit, variant, 'farmer', 'walking') },
    forager: { ...villagerSheets('forager'), loadedSheet: bakedAlias(bakedUnit, variant, 'forager', 'walking') },
    stoneminer: { ...villagerSheets('stoneminer'), loadedSheet: bakedAlias(bakedUnit, variant, 'stoneminer', 'loaded') },
    goldminer: { ...villagerSheets('goldminer'), loadedSheet: bakedAlias(bakedUnit, variant, 'goldminer', 'loaded') },
    woodcutter: { ...villagerSheets('woodcutter'), loadedSheet: bakedAlias(bakedUnit, variant, 'woodcutter', 'walking') },
    builder: villagerSheets('builder'),
  }
  unit.assets = unit.allAssets.default
  return true
}
