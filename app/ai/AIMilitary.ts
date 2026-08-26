import { ACTION_TYPES, FAMILY_TYPES, UNIT_TYPES } from '../constants'
import { getCellsAroundPoint, getBuildingContactDistance } from '../lib'
import { getEquipmentCombatStats, getUnitCombatRange, UNARMED_UNIT_WEAPON_POWER } from '../lib/equipment/equipmentStats'
import type { UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type {
  AIDefenseTarget,
  AIDifficultyConfig,
  AIEntityConfig,
  AIEntityLike,
  AIGridPosition,
  AIMemoryLike,
  AIMilitaryActionOptions,
  AIStrategyPlayerLike,
} from './types'

type AIMilitaryStrategyLike = {
  difficultyConfig: AIDifficultyConfig
}

type DefenseTargetCandidate = {
  memory: AIMemoryLike
  target: AIEntityLike | null
  dist: number
}

export class AIMilitary {
  ai: AIStrategyPlayerLike
  strategy: AIMilitaryStrategyLike

  constructor(ai: AIStrategyPlayerLike, strategy: AIMilitaryStrategyLike) {
    this.ai = ai
    this.strategy = strategy
  }

  sendToAttack(soldiers: AIEntityLike[], target: AIEntityLike, debug = false): void {
    if (target?.owner && !this.ai.isEnemy(target.owner)) return
    if (debug) console.log('Sending soldiers to attack:', target)

    const { map } = this.ai.context
    const targetCell = map.grid[target.i]?.[target.j]

    if (soldiers.length > 1 && targetCell?.solid) {
      const size = target.size || targetCell.has?.size || 1
      const dist = getBuildingContactDistance(size)
      const candidates = getCellsAroundPoint(
        target.i,
        target.j,
        map.grid,
        dist,
        cell => !cell.solid && cell.category !== 'Water'
      )
      const taken = new Set<RuntimeCell>()
      for (const soldier of soldiers) {
        let best: RuntimeCell | null = null,
          bestDist = Infinity
        for (const cell of candidates) {
          if (taken.has(cell)) continue
          const d = Math.abs(cell.i - soldier.i) + Math.abs(cell.j - soldier.j)
          if (d < bestDist) {
            bestDist = d
            best = cell
          }
        }
        if (best) {
          taken.add(best)
          soldier.sendToWithCell?.(target, best, ACTION_TYPES.attack)
        } else {
          soldier.sendTo?.(target, ACTION_TYPES.attack)
        }
      }
    } else {
      soldiers.forEach(c => c.sendTo?.(target, ACTION_TYPES.attack))
    }
  }

  getArmyCenter(units: AIEntityLike[]): AIGridPosition | null {
    if (!units.length) return null
    const sum = units.reduce((acc, unit) => ({ i: acc.i + unit.i, j: acc.j + unit.j }), { i: 0, j: 0 })
    return { i: sum.i / units.length, j: sum.j / units.length }
  }

  getEntityConfig(instance: AIEntityLike): AIEntityConfig | null {
    if (!instance?.type) return null
    if (instance.family === FAMILY_TYPES.unit) {
      return this.ai.config.units?.[instance.type] || null
    }
    if (instance.family === FAMILY_TYPES.building) {
      return this.ai.config.buildings?.[instance.type] || null
    }
    return null
  }

  getCombatPower(instance?: AIEntityLike | null): number {
    if (!instance || instance.isDead || instance.isDestroyed || (instance.hitPoints || 0) <= 0) return 0

    const config = this.getEntityConfig(instance) || {}
    const totalHitPoints = instance.totalHitPoints || config.totalHitPoints || instance.hitPoints || 1
    const hitPoints = Math.max(0, instance.hitPoints || totalHitPoints)
    const hpRatio = hitPoints / Math.max(1, totalHitPoints)
    const equipment = instance.equipment ?? (Array.isArray(config.equipment) ? config.equipment : [])
    const configuredWeaponPower = getEquipmentCombatStats(equipment, this.ai.config.equipment).weaponPower
    const weaponPower =
      configuredWeaponPower > 0
        ? configuredWeaponPower
        : instance.family === FAMILY_TYPES.unit
          ? UNARMED_UNIT_WEAPON_POWER
          : 0
    const range = (instance.family === FAMILY_TYPES.unit
      ? getUnitCombatRange(instance as UnitEntity)
      : instance.range) ?? 0
    const speed = instance.speed ?? config.speed ?? 0
    const meleeArmor = instance.meleeArmor ?? config.meleeArmor ?? 0
    const pierceArmor = instance.pierceArmor ?? config.pierceArmor ?? 0

    let power = 0
    power += totalHitPoints / 18
    power += weaponPower * (1 + Math.min(range, 8) * 0.08)
    power *= 1 + (meleeArmor + pierceArmor) * 0.04
    power *= 1 + Math.min(speed, 1.6) * 0.12

    if (range > 1) power *= 1.08
    if (instance.type === UNIT_TYPES.villager) power *= 0.35
    if (instance.type === UNIT_TYPES.scout) power *= 0.85
    if (instance.family === FAMILY_TYPES.building && !instance.isBuilt) power *= 0.25

    return power * (0.35 + hpRatio * 0.65)
  }

  getGroupCombatPower(units: AIEntityLike[] = []): number {
    return units.reduce((total, unit) => total + this.getCombatPower(unit), 0)
  }

  getDefenseTargets(): AIDefenseTarget[] {
    const { ai } = this
    const memories = ai
      .getEnemyMemories({ family: FAMILY_TYPES.unit, freshWithin: 15000 })
      .filter((memory: AIMemoryLike) => memory.visible || ai.getNow() - memory.lastSeenAt <= 6000)

    const protectedTargets = [...ai.units.filter((u: AIEntityLike) => u.type === UNIT_TYPES.villager), ...ai.buildings]
    return memories
      .map((memory: AIMemoryLike): DefenseTargetCandidate => {
        const closestProtected = protectedTargets.reduce(
          (best: { target: AIEntityLike | null; dist: number }, target: AIEntityLike) => {
            const dist = Math.abs(target.i - memory.i) + Math.abs(target.j - memory.j)
            return dist < best.dist ? { target, dist } : best
          },
          { target: null, dist: Infinity }
        )
        return { memory, ...closestProtected }
      })
      .filter((entry): entry is AIDefenseTarget => !!entry.target && entry.dist <= 10)
      .sort((a: AIDefenseTarget, b: AIDefenseTarget) => a.dist - b.dist)
  }

  getDefenseResponsePower(threat: AIEntityLike): number {
    const hostilePower = this.getCombatPower(threat)
    return hostilePower > 0 ? hostilePower * 1.2 : 0
  }

  getUnitByLabel(label: string): AIEntityLike | undefined {
    return this.ai.units.find((unit: AIEntityLike) => unit.label === label && !unit.isDead && !unit.isDestroyed)
  }

  handleActions({ waitingMilitary, debug = false }: AIMilitaryActionOptions): number {
    let actions = 0

    const availableMilitary = [...waitingMilitary]

    const defenseTargets = this.getDefenseTargets()
    if (defenseTargets.length > 0 && availableMilitary.length > 0) {
      const urgentThreat = defenseTargets[0].memory.instance
      if (urgentThreat) {
        const requiredDefensePower = this.getDefenseResponsePower(urgentThreat)
        const defenders: AIEntityLike[] = []
        let defenderPower = 0
        const candidates = availableMilitary.sort(
          (a, b) =>
            Math.abs(a.i - urgentThreat.i) +
            Math.abs(a.j - urgentThreat.j) -
            (Math.abs(b.i - urgentThreat.i) + Math.abs(b.j - urgentThreat.j))
        )
        for (const soldier of candidates) {
          defenders.push(soldier)
          defenderPower += this.getCombatPower(soldier)
          if (defenderPower >= requiredDefensePower) break
        }
        const defenderLabels = new Set(defenders.map((unit: AIEntityLike) => unit.label))
        for (let i = availableMilitary.length - 1; i >= 0; i--) {
          if (defenderLabels.has(availableMilitary[i].label)) {
            availableMilitary.splice(i, 1)
          }
        }
        if (debug) console.log('Enemy pressure near economy, sending local defenders:', defenders.length)
        this.sendToAttack(defenders, urgentThreat, debug)
        actions++
      }
    }

    return actions
  }
}
