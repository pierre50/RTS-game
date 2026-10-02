import { isInteriorTheftDefender } from '../../ai/AITheftDefense'
import type { EnemyMemory } from '../../ai/AIThreatManager'
import type { AIBuildingLike, AIEntityLike } from '../../ai/types'
import { ACTION_TYPES, FAMILY_TYPES, UNIT_TYPES } from '../../constants'
import { hasInteriorCombatRoute } from '../../lib/units/interiorCombat'

export type AIVillageDefenseHost = {
  getLivingChiefs(): AIEntityLike[]
  getEnemyMemories(options?: { family?: string | null; freshWithin?: number; visibleOnly?: boolean }): EnemyMemory[]
  isEnemy(owner?: unknown): boolean
}

export type AIVillageDefenseResult = {
  actions: number
  active: boolean
}

export function findVillageAnchor(towncenters: AIBuildingLike[]): AIBuildingLike | undefined {
  return towncenters.find(towncenter => towncenter.isBuilt && !towncenter.isDead && !towncenter.isDestroyed)
}

function isAliveCombatUnit(unit: AIEntityLike | null | undefined): unit is AIEntityLike {
  return Boolean(unit && !unit.isDead && !unit.isDestroyed && (unit.hitPoints ?? 1) > 0)
}

function getVisibleEnemyUnits(ai: AIVillageDefenseHost): AIEntityLike[] {
  const seen = new Set<string>()
  const enemies: AIEntityLike[] = []
  for (const memory of ai.getEnemyMemories({ family: FAMILY_TYPES.unit, visibleOnly: true, freshWithin: 2000 })) {
    const enemy = memory.instance
    if (!isAliveCombatUnit(enemy) || !enemy.owner || !ai.isEnemy(enemy.owner) || seen.has(enemy.label)) continue
    seen.add(enemy.label)
    enemies.push(enemy)
  }
  return enemies
}

function getPrimaryVillageDefenseTarget(ai: AIVillageDefenseHost, anchor: AIBuildingLike): AIEntityLike | null {
  const enemies = getVisibleEnemyUnits(ai)
  if (!enemies.length) return null
  return enemies.sort(
    (a, b) =>
      Math.abs(a.i - anchor.i) + Math.abs(a.j - anchor.j) - (Math.abs(b.i - anchor.i) + Math.abs(b.j - anchor.j))
  )[0]
}

function sendUnitToDefend(unit: AIEntityLike, target: AIEntityLike): boolean {
  if (
    !isAliveCombatUnit(unit) ||
    unit.controlMode === 'hero' ||
    isInteriorTheftDefender(unit) ||
    hasInteriorCombatRoute(unit)
  )
    return false
  if (unit.dest === target && unit.action === ACTION_TYPES.attack) return false
  unit.lookingAtHero = false
  if (unit.type === UNIT_TYPES.villager) {
    unit.sendToAttack?.(target, { keepPrevious: true })
  } else {
    unit.sendTo?.(target, ACTION_TYPES.attack)
  }
  return true
}

export function handleAIVisibleEnemyDefense(
  ai: AIVillageDefenseHost,
  {
    villagers,
    military,
    towncenters,
  }: {
    villagers: AIEntityLike[]
    military: AIEntityLike[]
    towncenters: AIBuildingLike[]
  }
): AIVillageDefenseResult {
  const anchor = findVillageAnchor(towncenters)
  if (!anchor) return { actions: 0, active: false }

  const target = getPrimaryVillageDefenseTarget(ai, anchor)
  if (!target) return { actions: 0, active: false }

  let actions = 0
  const defenders = [...ai.getLivingChiefs(), ...military, ...villagers]
  const assigned = new Set<string>()
  for (const defender of defenders) {
    if (!defender.label || assigned.has(defender.label)) continue
    assigned.add(defender.label)
    if (sendUnitToDefend(defender, target)) actions++
  }
  return { actions, active: true }
}
