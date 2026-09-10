import { knownTarget, playerSeesTarget } from '../lib/units/playerTargetKnowledge'
import type { PlayerLike } from '../types/player'
import type { RuntimeEntity } from '../types/entities'
import { ACTION_TYPES, RESOURCE_TYPES, WORK_TYPES } from '../constants'
import { getPlayerResourceTotals, hasPlayerResourceChests } from '../lib/resources/playerResourceTotals'
import type { AIEntityLike, AIStrategyPlayerLike } from './types'

// These wild animals supply leather while being butchered. Horses are reserved for capture.
const LEATHER_ANIMALS = new Set(['Boar', 'Deer', 'Fox', 'Hare', 'Wolf'])
type Material = 'fiber' | 'leather'
type MaterialEconomy = {
  ai: AIStrategyPlayerLike
  isLocationSafe(target: AIEntityLike): boolean
  sendVillagerExploring(unit: AIEntityLike): boolean
}

function materialTarget(target: AIEntityLike | null | undefined, material: Material): boolean {
  return Boolean(
    target && (material === 'fiber' ? target.type === RESOURCE_TYPES.fiberPlant : LEATHER_ANIMALS.has(target.type))
  )
}

/** Reserve at most two workers per missing material without interrupting construction or combat. */
export function assignAIBuildingMaterials(economy: MaterialEconomy, villagers: AIEntityLike[]): Set<AIEntityLike> {
  const { ai } = economy
  const demand = ai.strategy.getEconomicDemand()
  const resources = hasPlayerResourceChests(ai) ? getPlayerResourceTotals(ai) : ai
  const reserved = new Set<AIEntityLike>()
  for (const material of ['fiber', 'leather'] as const) {
    if ((demand[material] ?? 0) <= (resources[material] ?? 0)) continue
    const candidates =
      material === 'fiber'
        ? [...(ai.foundedResources?.[RESOURCE_TYPES.fiberPlant] ?? [])]
        : [...(ai.foundedDeadAnimals ?? []), ...(ai.foundedAnimals ?? [])]
    const targets = candidates.filter(target => {
      const owner = ai as unknown as PlayerLike
      const known = knownTarget(owner, target as RuntimeEntity)
      return (
        known &&
        materialTarget(target, material) &&
        !known.isDestroyed &&
        (known.quantity ?? 0) > 0 &&
        (material === 'leather' || !known.isDead) &&
        (known.family !== 'animal' || known.isDead || playerSeesTarget(owner, target as RuntimeEntity)) &&
        economy.isLocationSafe(target)
      )
    })
    const active = villagers.filter(
      unit => !unit.inactif && unit.dest && targets.includes(unit.dest as (typeof targets)[number])
    )
    active.slice(0, 2).forEach(unit => reserved.add(unit))
    if (active.length >= 2) continue
    const available = villagers
      .filter(
        unit =>
          !reserved.has(unit) &&
          !unit.isDead &&
          !unit.isDestroyed &&
          !unit.isChief &&
          unit.controlMode !== 'hero' &&
          (unit.inactif ||
            [WORK_TYPES.woodcutter, WORK_TYPES.stoneminer, WORK_TYPES.forager, WORK_TYPES.farmer].includes(
              unit.work ?? ''
            )) &&
          ![
            ACTION_TYPES.attack,
            ACTION_TYPES.flee,
            ACTION_TYPES.build,
            ACTION_TYPES.train,
            ACTION_TYPES.delivery,
          ].includes(unit.action ?? '')
      )
      .sort((a, b) => Number(Boolean(b.inactif)) - Number(Boolean(a.inactif)))
    const worker = available[0]
    if (!worker) continue
    const target = targets.sort(
      (a, b) =>
        Number(Boolean(b.isDead)) - Number(Boolean(a.isDead)) ||
        Math.abs(a.i - worker.i) + Math.abs(a.j - worker.j) - Math.abs(b.i - worker.i) - Math.abs(b.j - worker.j)
    )[0]
    if (!target) {
      if (worker.inactif && economy.sendVillagerExploring(worker)) reserved.add(worker)
      continue
    }
    const sent =
      material === 'fiber'
        ? worker.sendToBerrybush?.(target)
        : target.isDead
          ? worker.sendToTakeMeat?.(target)
          : worker.sendToHunt?.(target)
    if (sent !== false) reserved.add(worker)
  }
  return reserved
}
