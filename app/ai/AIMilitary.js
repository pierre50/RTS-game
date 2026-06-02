import { ACTION_TYPES, BUILDING_TYPES, UNIT_TYPES } from '../constants'
import { getCellsAroundPoint, randomRange } from '../lib'

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

  getBestEnemyTarget() {
    const { foundedEnemyBuildings } = this.ai
    const enemyPlayers = this.ai.enemyPlayers()
    return (
      [...foundedEnemyBuildings].find(b => b.type === BUILDING_TYPES.townCenter && this.ai.isEnemy(b.owner)) ||
      [...foundedEnemyBuildings].find(b => this.ai.isEnemy(b.owner)) ||
      enemyPlayers
        .flatMap(player => player.buildings)
        .find(b => b.type === BUILDING_TYPES.townCenter && b.hitPoints > 0 && !b.isDead) ||
      enemyPlayers.flatMap(player => player.buildings).find(b => b.hitPoints > 0 && !b.isDead) ||
      enemyPlayers[0]
    )
  }

  handleActions({ waitingMilitary, inactifMilitary, howManySoldiersBeforeAttack, debug = false }) {
    const { ai } = this
    const { difficultyConfig } = this.strategy
    const { map } = ai.context
    let actions = 0

    const availableMilitary = [...waitingMilitary]

    if (ai.foundedEnemyUnits.size > 0 && availableMilitary.length > 0) {
      const enemyUnit = [...ai.foundedEnemyUnits].find(u => u.hitPoints > 0 && ai.isEnemy(u.owner))
      if (enemyUnit) {
        if (debug) console.log('Enemy units spotted! Defending...')
        const responseCount = Math.max(1, Math.ceil(availableMilitary.length / 2))
        this.sendToAttack(availableMilitary.splice(0, responseCount), enemyUnit, debug)
        actions++
      }
    }

    const raidThreshold = difficultyConfig.raidThreshold
    const raidSize = difficultyConfig.raidSize
    if (raidThreshold > 0 && ai.phase === 'military_build' && availableMilitary.length >= raidThreshold) {
      const raidTarget =
        [...ai.foundedEnemyUnits].find(u => u.hitPoints > 0 && u.type === UNIT_TYPES.villager && ai.isEnemy(u.owner)) ||
        this.getBestEnemyTarget()
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
        const target =
          this.getBestEnemyTarget() ||
          map.grid[randomRange(0, map.grid.length - 1)][randomRange(0, map.grid[0].length - 1)]
        if (debug)
          console.log(
            `Launching attack wave! ${attackers.length} attackers, ${defenderCount} defenders. Target:`,
            target
          )
        this.sendToAttack(attackers, target, debug)
        actions++
      }
    }

    if (inactifMilitary.length && ai.foundedEnemyBuildings.size) {
      const target = this.getBestEnemyTarget()
      if (target) {
        if (debug) console.log('Redirecting assault soldiers to:', target)
        this.sendToAttack(inactifMilitary, target, debug)
        actions++
      }
    }

    return actions
  }
}
