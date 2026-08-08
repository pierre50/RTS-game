import { ACTION_TYPES, BUILDING_TYPES, FAMILY_TYPES, UNIT_TYPES } from '../constants'
import { getCellsAroundPoint, getBuildingContactDistance } from '../lib'
import { getEquipmentCombatStats, UNARMED_UNIT_WEAPON_POWER } from '../lib/equipmentStats'
import { BASE_TARGET_VALUE_BY_TYPE } from './config'
import type { RuntimeCell } from '../types/map'
import type {
  AIBuildingLike,
  AIDefenseTarget,
  AIDifficultyConfig,
  AIEntityConfig,
  AIEntityLike,
  AIEnemyPlayerLike,
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
    soldiers.forEach(c => {
      c.assault = true
    })

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
    const range = instance.range ?? config.range ?? 0
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

  getDesiredAttackPower(): number {
    const { ai } = this
    const baseThreshold = Math.max(this.strategy.difficultyConfig.attackThreshold, 2)
    return baseThreshold * 7 + ai.age * 4
  }

  estimateLocalThreat(target: AIGridPosition): number {
    const freshUnits = this.ai.getEnemyMemories({ family: FAMILY_TYPES.unit, freshWithin: 20000 })
    const freshBuildings = this.ai.getEnemyMemories({ family: FAMILY_TYPES.building, freshWithin: 30000 })
    let threat = 0

    for (const memory of freshUnits) {
      const dist = Math.abs(memory.i - target.i) + Math.abs(memory.j - target.j)
      if (dist <= 8) threat += this.getCombatPower(memory.instance) * (1 - dist / 12)
    }
    for (const memory of freshBuildings) {
      const dist = Math.abs(memory.i - target.i) + Math.abs(memory.j - target.j)
      if (dist <= 8) threat += this.getCombatPower(memory.instance) * (1 - dist / 14)
    }

    return Math.max(0, threat)
  }

  estimateTargetDefensePower(target: AIEntityLike | null): number {
    if (!target) return 0
    return this.getCombatPower(target) + this.estimateLocalThreat(target)
  }

  scoreEnemyTarget(memory: AIMemoryLike, armyCenter: AIGridPosition | null): number {
    const target = memory.instance
    if (!target || target.isDead || target.isDestroyed) return -Infinity

    const travelCost = armyCenter ? (Math.abs(target.i - armyCenter.i) + Math.abs(target.j - armyCenter.j)) / 4 : 0
    const freshnessPenalty = memory.visible ? 0 : Math.min(6, (this.ai.getNow() - memory.lastSeenAt) / 4000)
    const localThreat = this.estimateLocalThreat(target) / 8
    const hpRatio = target.totalHitPoints ? (target.hitPoints || 0) / target.totalHitPoints : 1
    const finishBonus = 1 - hpRatio
    const baseValue = BASE_TARGET_VALUE_BY_TYPE[target.type] || (target.family === FAMILY_TYPES.building ? 6 : 5)

    return baseValue + finishBonus * 3 - travelCost - localThreat - freshnessPenalty
  }

  getBestEnemyTarget(units: AIEntityLike[] = []): AIEntityLike | null {
    const armyCenter = this.getArmyCenter(units)
    const candidates = this.ai
      .getEnemyMemories({ freshWithin: 45000 })
      .filter((memory: AIMemoryLike) => (memory.instance?.hitPoints || 0) > 0)

    if (candidates.length) {
      return (
        candidates
          .slice()
          .sort(
            (a: AIMemoryLike, b: AIMemoryLike) =>
              this.scoreEnemyTarget(b, armyCenter) - this.scoreEnemyTarget(a, armyCenter)
          )[0].instance || null
      )
    }

    const enemyPlayers = this.ai.enemyPlayers()
    return (
      enemyPlayers
        .flatMap((player: AIEnemyPlayerLike) => player.buildings)
        .find((b: AIBuildingLike) => b.type === BUILDING_TYPES.townCenter && (b.hitPoints || 0) > 0 && !b.isDead) ||
      enemyPlayers
        .flatMap((player: AIEnemyPlayerLike) => player.buildings)
        .find((b: AIBuildingLike) => (b.hitPoints || 0) > 0 && !b.isDead) ||
      null
    )
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

  getMinAttackForce(): number {
    return Math.max(this.strategy.difficultyConfig.attackThreshold, 3 + this.ai.age)
  }

  getHomeDefenseReserve(units: AIEntityLike[] = []): number {
    const baseReserve = Math.max(1, Math.ceil(units.length * this.strategy.difficultyConfig.defenderRatio))
    const townCenters = this.ai.buildings.filter(
      (building: AIBuildingLike) =>
        building.type === BUILDING_TYPES.townCenter && !building.isDead && !building.isDestroyed
    ).length
    return Math.min(units.length, Math.max(baseReserve, townCenters > 1 ? 3 : 2))
  }

  splitAttackForce(
    units: AIEntityLike[] = [],
    minAttackForce = 0
  ): { defenders: AIEntityLike[]; attackers: AIEntityLike[] } {
    if (units.length < minAttackForce) {
      return { defenders: units.slice(), attackers: [] }
    }

    const defendersToKeep = this.getHomeDefenseReserve(units)
    const attackers = units.slice(defendersToKeep)

    if (attackers.length < minAttackForce) {
      return { defenders: units.slice(), attackers: [] }
    }

    return {
      defenders: units.slice(0, defendersToKeep),
      attackers,
    }
  }

  hasActiveAssault(): boolean {
    return this.ai.units.some(
      (unit: AIEntityLike) =>
        unit &&
        unit.assault &&
        unit.type !== UNIT_TYPES.villager &&
        !unit.isDead &&
        !unit.isDestroyed &&
        (unit.hitPoints || 0) > 0 &&
        unit.action === ACTION_TYPES.attack
    )
  }

  canCommitToTarget(
    force: AIEntityLike[],
    target: AIEntityLike | null,
    desiredPowerRatio = 0.65,
    defenseRatio = 1.1
  ): boolean {
    if (!target || force.length === 0) return false
    const forcePower = this.getGroupCombatPower(force)
    const targetDefensePower = this.estimateTargetDefensePower(target)
    return forcePower >= Math.max(this.getDesiredAttackPower() * desiredPowerRatio, targetDefensePower * defenseRatio)
  }

  getDefenseResponsePower(threat: AIEntityLike): number {
    const hostilePower = this.getCombatPower(threat)
    return hostilePower > 0 ? hostilePower * 1.2 : 0
  }

  releaseIdleAssault(inactifMilitary: AIEntityLike[]): void {
    for (const soldier of inactifMilitary) {
      soldier.assault = false
    }
  }

  getUnitByLabel(label: string): AIEntityLike | undefined {
    return this.ai.units.find((unit: AIEntityLike) => unit.label === label && !unit.isDead && !unit.isDestroyed)
  }

  handleActions({
    waitingMilitary,
    inactifMilitary,
    howManySoldiersBeforeAttack,
    debug = false,
  }: AIMilitaryActionOptions): number {
    const { ai } = this
    const { difficultyConfig } = this.strategy
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

    const raidThreshold = difficultyConfig.raidThreshold
    const raidSize = difficultyConfig.raidSize
    if (
      raidThreshold > 0 &&
      ai.phase === 'military_build' &&
      availableMilitary.length >= raidThreshold &&
      ai.getNow() - (ai.lastAttackWaveAt || 0) >= Math.max(6000, difficultyConfig.attackCooldownMs / 2)
    ) {
      const raidTarget =
        ai
          .getFreshEnemyInstances?.({ family: FAMILY_TYPES.unit, freshWithin: 25000 })
          ?.find(
            (u: AIEntityLike) => (u.hitPoints || 0) > 0 && u.type === UNIT_TYPES.villager && ai.isEnemy(u.owner)
          ) || this.getBestEnemyTarget(availableMilitary)
      const raidParty = availableMilitary.slice(0, raidSize)
      const raidPower = this.getGroupCombatPower(raidParty)
      const targetDefensePower = this.estimateTargetDefensePower(raidTarget)
      if (raidTarget) {
        if (raidPower >= Math.max(6, targetDefensePower * 0.85)) {
          if (debug) console.log(`Early raid! Sending ${raidSize} soldiers to harass.`)
          this.sendToAttack(availableMilitary.splice(0, raidSize), raidTarget, debug)
          ai.lastAttackWaveAt = ai.getNow()
          actions++
        } else if (debug) {
          console.log(`Skipping raid, power too low: ${Math.round(raidPower)} vs ${Math.round(targetDefensePower)}`)
        }
      }
    }

    const minAttackForce = Math.max(howManySoldiersBeforeAttack, this.getMinAttackForce())
    const minAttackers = Math.max(2, Math.ceil(minAttackForce * 0.6))
    const availablePower = this.getGroupCombatPower(availableMilitary)
    if (
      ai.phase === 'attack' &&
      availableMilitary.length >= minAttackForce &&
      availablePower >= this.getDesiredAttackPower() &&
      ai.getNow() - (ai.lastAttackWaveAt || 0) >= difficultyConfig.attackCooldownMs
    ) {
      const { attackers } = this.splitAttackForce(availableMilitary, minAttackForce)
      if (attackers.length >= minAttackers) {
        const target = this.getBestEnemyTarget(attackers)
        if (debug)
          console.log(
            `Launching attack wave! ${attackers.length} attackers, ${availableMilitary.length - attackers.length} defenders held home. Target:`,
            target
          )
        if (target && this.canCommitToTarget(attackers, target, 0.65, 1.15)) {
          this.sendToAttack(attackers, target, debug)
          ai.lastAttackWaveAt = ai.getNow()
          actions++
        }
      }
    }

    const regroupCooldownMs = Math.max(8000, Math.round(difficultyConfig.attackCooldownMs * 0.75))
    if (
      inactifMilitary.length >= minAttackers &&
      ai.phase === 'attack' &&
      ai.getEnemyMemories({ family: FAMILY_TYPES.building, freshWithin: 45000 }).length &&
      ai.getNow() - (ai.lastAttackWaveAt || 0) >= regroupCooldownMs
    ) {
      const target = this.getBestEnemyTarget(inactifMilitary)
      const reinforcingActiveAssault = this.hasActiveAssault()
      const canRejoinAttack = reinforcingActiveAssault
        ? this.canCommitToTarget(inactifMilitary, target, 0.45, 0.9)
        : this.canCommitToTarget(inactifMilitary, target, 0.65, 1.1)

      if (target && canRejoinAttack) {
        if (debug)
          console.log(
            reinforcingActiveAssault ? 'Sending reinforcements to assault:' : 'Redirecting assault soldiers to:',
            target
          )
        this.sendToAttack(inactifMilitary, target, debug)
        ai.lastAttackWaveAt = ai.getNow()
        actions++
      } else if (!reinforcingActiveAssault) {
        this.releaseIdleAssault(inactifMilitary)
      }
    } else if (inactifMilitary.length) {
      const reinforcingActiveAssault = ai.phase === 'attack' && this.hasActiveAssault()
      if (!reinforcingActiveAssault) {
        this.releaseIdleAssault(inactifMilitary)
      }
    }

    return actions
  }
}
