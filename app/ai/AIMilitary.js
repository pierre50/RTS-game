import { ACTION_TYPES, BUILDING_TYPES, FAMILY_TYPES, UNIT_TYPES } from '../constants'
import { getCellsAroundPoint } from '../lib'
import { BASE_TARGET_VALUE_BY_TYPE } from './config'

export class AIMilitary {
  constructor(ai, strategy) {
    this.ai = ai
    this.strategy = strategy
  }

  sendToAttack(soldiers, target, debug = false) {
    if (target?.owner && !this.ai.isEnemy(target.owner)) return
    if (debug) console.log('Sending soldiers to attack:', target)
    soldiers.forEach(c => {
      c.assault = true
    })

    const { map } = this.ai.context
    const targetCell = map.grid[target.i]?.[target.j]

    if (soldiers.length > 1 && targetCell?.solid) {
      const size = target.size || targetCell.has?.size || 1
      const dist = size === 3 ? 2 : 1
      const candidates = getCellsAroundPoint(
        target.i,
        target.j,
        map.grid,
        dist,
        cell => !cell.solid && cell.category !== 'Water'
      )
      const taken = new Set()
      for (const soldier of soldiers) {
        let best = null,
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
          soldier.sendToWithCell(target, best, ACTION_TYPES.attack)
        } else {
          soldier.sendTo(target, ACTION_TYPES.attack)
        }
      }
    } else {
      soldiers.forEach(c => c.sendTo(target, ACTION_TYPES.attack))
    }
  }

  getArmyCenter(units) {
    if (!units.length) return null
    const sum = units.reduce((acc, unit) => ({ i: acc.i + unit.i, j: acc.j + unit.j }), { i: 0, j: 0 })
    return { i: sum.i / units.length, j: sum.j / units.length }
  }

  estimateLocalThreat(target) {
    const freshUnits = this.ai.getEnemyMemories({ family: FAMILY_TYPES.unit, freshWithin: 20000 })
    const freshBuildings = this.ai.getEnemyMemories({ family: FAMILY_TYPES.building, freshWithin: 30000 })
    let threat = 0

    for (const memory of freshUnits) {
      const dist = Math.abs(memory.i - target.i) + Math.abs(memory.j - target.j)
      if (dist <= 8) threat += memory.type === UNIT_TYPES.villager ? 0.5 : 1.5
    }
    for (const memory of freshBuildings) {
      const dist = Math.abs(memory.i - target.i) + Math.abs(memory.j - target.j)
      if (dist <= 8) threat += memory.type === BUILDING_TYPES.townCenter ? 3 : 2
    }

    return threat
  }

  scoreEnemyTarget(memory, armyCenter) {
    const target = memory.instance
    if (!target || target.isDead || target.isDestroyed) return -Infinity

    const travelCost = armyCenter ? (Math.abs(target.i - armyCenter.i) + Math.abs(target.j - armyCenter.j)) / 4 : 0
    const freshnessPenalty = memory.visible ? 0 : Math.min(6, (this.ai.getNow() - memory.lastSeenAt) / 4000)
    const localThreat = this.estimateLocalThreat(target)
    const hpRatio = target.totalHitPoints ? target.hitPoints / target.totalHitPoints : 1
    const finishBonus = 1 - hpRatio
    const baseValue = BASE_TARGET_VALUE_BY_TYPE[target.type] || (target.family === FAMILY_TYPES.building ? 6 : 5)

    return baseValue + finishBonus * 3 - travelCost - localThreat - freshnessPenalty
  }

  getBestEnemyTarget(units = []) {
    const armyCenter = this.getArmyCenter(units)
    const candidates = this.ai.getEnemyMemories({ freshWithin: 45000 }).filter(memory => memory.instance?.hitPoints > 0)

    if (candidates.length) {
      return candidates
        .slice()
        .sort((a, b) => this.scoreEnemyTarget(b, armyCenter) - this.scoreEnemyTarget(a, armyCenter))[0].instance
    }

    const enemyPlayers = this.ai.enemyPlayers()
    return (
      enemyPlayers
        .flatMap(player => player.buildings)
        .find(b => b.type === BUILDING_TYPES.townCenter && b.hitPoints > 0 && !b.isDead) ||
      enemyPlayers.flatMap(player => player.buildings).find(b => b.hitPoints > 0 && !b.isDead) ||
      null
    )
  }

  getDefenseTargets() {
    const { ai } = this
    const memories = ai
      .getEnemyMemories({ family: FAMILY_TYPES.unit, freshWithin: 15000 })
      .filter(memory => memory.visible || ai.getNow() - memory.lastSeenAt <= 6000)

    const protectedTargets = [...ai.units.filter(u => u.type === UNIT_TYPES.villager), ...ai.buildings]
    return memories
      .map(memory => {
        const closestProtected = protectedTargets.reduce(
          (best, target) => {
            const dist = Math.abs(target.i - memory.i) + Math.abs(target.j - memory.j)
            return dist < best.dist ? { target, dist } : best
          },
          { target: null, dist: Infinity }
        )
        return { memory, ...closestProtected }
      })
      .filter(entry => entry.target && entry.dist <= 10)
      .sort((a, b) => a.dist - b.dist)
  }

  handleActions({ waitingMilitary, inactifMilitary, howManySoldiersBeforeAttack, debug = false }) {
    const { ai } = this
    const { difficultyConfig } = this.strategy
    let actions = 0

    const availableMilitary = [...waitingMilitary]

    const defenseTargets = this.getDefenseTargets()
    if (defenseTargets.length > 0 && availableMilitary.length > 0) {
      const urgentThreat = defenseTargets[0].memory.instance
      if (urgentThreat) {
        const responseCount = Math.min(
          availableMilitary.length,
          Math.max(1, Math.ceil(1 + this.estimateLocalThreat(urgentThreat) / 2))
        )
        const defenders = availableMilitary
          .sort(
            (a, b) =>
              Math.abs(a.i - urgentThreat.i) +
              Math.abs(a.j - urgentThreat.j) -
              (Math.abs(b.i - urgentThreat.i) + Math.abs(b.j - urgentThreat.j))
          )
          .splice(0, responseCount)
        if (debug) console.log('Enemy pressure near economy, sending local defenders:', defenders.length)
        this.sendToAttack(defenders, urgentThreat, debug)
        actions++
      }
    }

    const raidThreshold = difficultyConfig.raidThreshold
    const raidSize = difficultyConfig.raidSize
    if (raidThreshold > 0 && ai.phase === 'military_build' && availableMilitary.length >= raidThreshold) {
      const raidTarget =
        ai
          .getFreshEnemyInstances({ family: FAMILY_TYPES.unit, freshWithin: 25000 })
          .find(u => u.hitPoints > 0 && u.type === UNIT_TYPES.villager && ai.isEnemy(u.owner)) ||
        this.getBestEnemyTarget(availableMilitary)
      if (raidTarget) {
        if (debug) console.log(`Early raid! Sending ${raidSize} soldiers to harass.`)
        this.sendToAttack(availableMilitary.splice(0, raidSize), raidTarget, debug)
        actions++
      }
    }

    if (ai.phase === 'attack' && availableMilitary.length >= howManySoldiersBeforeAttack) {
      const defenderCount = Math.max(2, Math.floor(availableMilitary.length * difficultyConfig.defenderRatio))
      const attackers = availableMilitary.slice(defenderCount)
      if (attackers.length > 0) {
        const target = this.getBestEnemyTarget(attackers)
        if (debug)
          console.log(
            `Launching attack wave! ${attackers.length} attackers, ${defenderCount} defenders. Target:`,
            target
          )
        if (target) {
          this.sendToAttack(attackers, target, debug)
          actions++
        }
      }
    }

    if (inactifMilitary.length && ai.getEnemyMemories({ family: FAMILY_TYPES.building, freshWithin: 45000 }).length) {
      const target = this.getBestEnemyTarget(inactifMilitary)
      if (target) {
        if (debug) console.log('Redirecting assault soldiers to:', target)
        this.sendToAttack(inactifMilitary, target, debug)
        actions++
      }
    }

    return actions
  }
}
