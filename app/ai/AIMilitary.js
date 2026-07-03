import { ACTION_TYPES, BUILDING_TYPES, FAMILY_TYPES, UNIT_TYPES } from '../constants'
import {
  findLoadShoreCell,
  findTransportCoastCell,
  getCellsAroundPoint,
  getInstancePath,
  getTransportLoad,
  unloadTransport,
} from '../lib'
import { BASE_TARGET_VALUE_BY_TYPE } from './config'

const NAVAL_TRANSPORT_GROUP_MIN = 4
const NAVAL_TRANSPORT_GROUP_MAX = 5
const NAVAL_LANDING_SEARCH_RADIUS = 28
const NAVAL_LANDING_PATH_ATTEMPTS = 48
const NAVAL_OPERATION_TIMEOUT_MS = 90000
const NAVAL_OPERATION_RETRY_MS = 20000

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

  getEntityConfig(instance) {
    if (!instance?.type) return null
    if (instance.family === FAMILY_TYPES.unit) {
      return this.ai.config.units?.[instance.type] || null
    }
    if (instance.family === FAMILY_TYPES.building) {
      return this.ai.config.buildings?.[instance.type] || null
    }
    return null
  }

  getCombatPower(instance) {
    if (!instance || instance.isDead || instance.isDestroyed || instance.hitPoints <= 0) return 0

    const config = this.getEntityConfig(instance) || {}
    const totalHitPoints = instance.totalHitPoints || config.totalHitPoints || instance.hitPoints || 1
    const hitPoints = Math.max(0, instance.hitPoints || totalHitPoints)
    const hpRatio = hitPoints / Math.max(1, totalHitPoints)
    const meleeAttack = instance.meleeAttack ?? config.meleeAttack ?? 0
    const pierceAttack = instance.pierceAttack ?? config.pierceAttack ?? 0
    const range = instance.range ?? config.range ?? 0
    const rateOfFire = instance.rateOfFire ?? config.rateOfFire ?? 1.5
    const speed = instance.speed ?? config.speed ?? 0
    const meleeArmor = instance.meleeArmor ?? config.meleeArmor ?? 0
    const pierceArmor = instance.pierceArmor ?? config.pierceArmor ?? 0

    let power = 0
    power += totalHitPoints / 18
    power += (meleeAttack + pierceAttack * 1.2) * (1 + Math.min(range, 8) * 0.08)
    power *= 1 + (meleeArmor + pierceArmor) * 0.04
    power *= 1 + Math.min(speed, 1.6) * 0.12
    power *= 1 + Math.max(0, 1.4 - rateOfFire) * 0.35

    if (range > 1) power *= 1.08
    if (instance.type === UNIT_TYPES.villager) power *= 0.35
    if (instance.type === UNIT_TYPES.scout) power *= 0.85
    if (instance.family === FAMILY_TYPES.building && !instance.isBuilt) power *= 0.25

    return power * (0.35 + hpRatio * 0.65)
  }

  getGroupCombatPower(units = []) {
    return units.reduce((total, unit) => total + this.getCombatPower(unit), 0)
  }

  getDesiredAttackPower() {
    const { ai } = this
    const baseThreshold = Math.max(this.strategy.difficultyConfig.attackThreshold, 2)
    return baseThreshold * 7 + ai.age * 4
  }

  estimateLocalThreat(target) {
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

  estimateTargetDefensePower(target) {
    if (!target) return 0
    return this.getCombatPower(target) + this.estimateLocalThreat(target)
  }

  scoreEnemyTarget(memory, armyCenter) {
    const target = memory.instance
    if (!target || target.isDead || target.isDestroyed) return -Infinity

    const travelCost = armyCenter ? (Math.abs(target.i - armyCenter.i) + Math.abs(target.j - armyCenter.j)) / 4 : 0
    const freshnessPenalty = memory.visible ? 0 : Math.min(6, (this.ai.getNow() - memory.lastSeenAt) / 4000)
    const localThreat = this.estimateLocalThreat(target) / 8
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

  getMinAttackForce() {
    return Math.max(this.strategy.difficultyConfig.attackThreshold, 3 + this.ai.age)
  }

  getHomeDefenseReserve(units = []) {
    const baseReserve = Math.max(1, Math.ceil(units.length * this.strategy.difficultyConfig.defenderRatio))
    const townCenters = this.ai.buildings.filter(
      building => building.type === BUILDING_TYPES.townCenter && !building.isDead && !building.isDestroyed
    ).length
    return Math.min(units.length, Math.max(baseReserve, townCenters > 1 ? 3 : 2))
  }

  splitAttackForce(units = [], minAttackForce = 0) {
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

  hasActiveAssault() {
    return this.ai.units.some(
      unit =>
        unit &&
        unit.assault &&
        unit.type !== UNIT_TYPES.villager &&
        !unit.isDead &&
        !unit.isDestroyed &&
        unit.hitPoints > 0 &&
        unit.action === ACTION_TYPES.attack
    )
  }

  canCommitToTarget(force, target, desiredPowerRatio = 0.65, defenseRatio = 1.1) {
    if (!target || force.length === 0) return false
    const forcePower = this.getGroupCombatPower(force)
    const targetDefensePower = this.estimateTargetDefensePower(target)
    return forcePower >= Math.max(this.getDesiredAttackPower() * desiredPowerRatio, targetDefensePower * defenseRatio)
  }

  getDefenseResponsePower(threat) {
    const hostilePower = this.getCombatPower(threat)
    return hostilePower > 0 ? hostilePower * 1.2 : 0
  }

  releaseIdleAssault(inactifMilitary) {
    for (const soldier of inactifMilitary) {
      soldier.assault = false
    }
  }

  getUnitByLabel(label) {
    return this.ai.units.find(unit => unit.label === label && !unit.isDead && !unit.isDestroyed)
  }

  getTransportCandidates() {
    return this.ai
      .getLivingUnitsByType(UNIT_TYPES.lightTransport)
      .filter(transport => transport && !transport.isDead && !transport.isDestroyed)
  }

  getLandingTarget() {
    return this.getBestEnemyTarget() || null
  }

  hasLandingRoom(cell) {
    if (!cell) return false
    const { map } = this.ai.context
    return (
      getCellsAroundPoint(
        cell.i,
        cell.j,
        map.grid,
        2,
        candidate =>
          candidate.category !== 'Water' &&
          !candidate.waterBorder &&
          !candidate.solid &&
          !candidate.border &&
          !candidate.inclined
      ).length > 0
    )
  }

  findLandingCell(transport, target) {
    if (!transport || !target) return null
    const { map } = this.ai.context
    const candidates = []
    const minI = Math.max(0, target.i - NAVAL_LANDING_SEARCH_RADIUS)
    const maxI = Math.min(map.size - 1, target.i + NAVAL_LANDING_SEARCH_RADIUS)
    const minJ = Math.max(0, target.j - NAVAL_LANDING_SEARCH_RADIUS)
    const maxJ = Math.min(map.size - 1, target.j + NAVAL_LANDING_SEARCH_RADIUS)

    for (let i = minI; i <= maxI; i++) {
      for (let j = minJ; j <= maxJ; j++) {
        const cell = map.grid[i]?.[j]
        if (!cell?.waterBorder || cell.solid || cell.border) continue
        if (!this.hasLandingRoom(cell)) continue
        candidates.push({
          cell,
          targetDistance: Math.abs(cell.i - target.i) + Math.abs(cell.j - target.j),
          transportDistance: Math.abs(cell.i - transport.i) + Math.abs(cell.j - transport.j),
        })
      }
    }

    candidates.sort(
      (a, b) => a.targetDistance - b.targetDistance || a.transportDistance - b.transportDistance
    )

    let best = null
    let bestScore = Infinity
    for (const { cell, targetDistance } of candidates.slice(0, NAVAL_LANDING_PATH_ATTEMPTS)) {
      const path = getInstancePath(transport, cell.i, cell.j, map)
      if (!path.length && (transport.i !== cell.i || transport.j !== cell.j)) continue
      const score = path.length + targetDistance
      if (score < bestScore) {
        bestScore = score
        best = cell
      }
    }

    return best
  }

  clearNavalOperation(reason = null, debug = false, { keepAssault = false } = {}) {
    const operation = this.ai.navalOperation
    if (!operation) return
    if (!keepAssault) {
      for (const label of operation.unitLabels || []) {
        const unit = this.getUnitByLabel(label)
        if (unit && !unit.loadedInTransport) unit.assault = false
      }
    }
    this.ai.navalOperation = null
    this.ai.lastNavalOperationEndedAt = this.ai.getNow()
    this.ai.lastNavalOperationFailure = reason
    if (debug && reason) console.log('Naval operation ended:', reason)
  }

  handleActiveNavalOperation(debug = false) {
    const operation = this.ai.navalOperation
    if (!operation) return 0

    const now = this.ai.getNow()
    const transport = this.getUnitByLabel(operation.transportLabel)
    const target = operation.targetLabel
      ? this.ai.getEnemyMemories({ freshWithin: Infinity }).find(memory => memory.label === operation.targetLabel)
          ?.instance
      : this.getLandingTarget()

    if (!transport || !target || now - operation.startedAt > NAVAL_OPERATION_TIMEOUT_MS) {
      this.clearNavalOperation('lost transport/target or timeout', debug)
      return 0
    }

    const cargoLoad = getTransportLoad(transport)
    const units = operation.unitLabels.map(label => this.getUnitByLabel(label)).filter(Boolean)

    if (operation.stage === 'loading') {
      const loadShoreCell = this.ai.context.map.grid[operation.loadShoreCell?.i]?.[operation.loadShoreCell?.j]
      const loadCoastCell = this.ai.context.map.grid[operation.loadCoastCell?.i]?.[operation.loadCoastCell?.j]
      if (!loadShoreCell || !loadCoastCell) {
        this.clearNavalOperation('lost load shore', debug)
        return 0
      }
      if ((transport.inactif || !transport.path?.length) && (transport.i !== loadCoastCell.i || transport.j !== loadCoastCell.j)) {
        transport.sendTo(loadCoastCell)
      }
      for (const unit of units) {
        if (!unit.loadedInTransport && unit.inactif && getTransportLoad(transport) < transport.transportCapacity) {
          unit.transportLoadShoreCell = loadShoreCell
          unit.transportLoadCoastCell = loadCoastCell
          unit.sendToWithCell(transport, loadShoreCell, ACTION_TYPES.loadTransport)
        }
      }

      const allLoaded = units.length > 0 && units.every(unit => unit.loadedInTransport === transport)
      const enoughLoaded = cargoLoad >= Math.min(NAVAL_TRANSPORT_GROUP_MIN, units.length)
      const waitedLongEnough = now - operation.startedAt > 15000 && cargoLoad > 0
      if (allLoaded || enoughLoaded || waitedLongEnough) {
        const landingCell = this.findLandingCell(transport, target)
        if (!landingCell) {
          this.clearNavalOperation('no landing cell', debug)
          return 0
        }
        operation.stage = 'sailing'
        operation.landingCell = { i: landingCell.i, j: landingCell.j }
        transport.sendTo(landingCell)
        if (debug) console.log('Naval transport sailing with cargo:', cargoLoad)
        return 1
      }
      return 0
    }

    if (operation.stage === 'sailing') {
      const landingCell = this.ai.context.map.grid[operation.landingCell?.i]?.[operation.landingCell?.j]
      if (!landingCell) {
        this.clearNavalOperation('landing cell disappeared', debug)
        return 0
      }
      if (transport.i !== landingCell.i || transport.j !== landingCell.j) {
        if (transport.inactif && !transport.path?.length) transport.sendTo(landingCell)
        return 0
      }

      const cargo = [...(transport.transportedUnits || [])]
      const unloaded = unloadTransport(transport)
      if (!unloaded) return 0
      operation.stage = 'assault'
      for (const unit of cargo) {
        if (unit && !unit.loadedInTransport && !unit.isDead && !unit.isDestroyed) {
          unit.assault = true
          unit.sendTo(target, ACTION_TYPES.attack)
        }
      }
      this.ai.lastAttackWaveAt = now
      this.clearNavalOperation('unloaded assault', debug, { keepAssault: true })
      this.ai.lastNavalOperationFailure = null
      return 1
    }

    this.clearNavalOperation('unknown stage', debug)
    return 0
  }

  maybeStartNavalTransportAttack(availableMilitary, debug = false) {
    const { ai } = this
    if (ai.navalOperation) return 0
    if (ai.getNow() - (ai.lastNavalOperationEndedAt || -Infinity) < NAVAL_OPERATION_RETRY_MS) return 0
    if (!ai.strategy.needsNavalTransport(availableMilitary.length)) return 0

    const transport = this.getTransportCandidates().find(candidate => candidate.inactif && getTransportLoad(candidate) === 0)
    if (!transport) return 0

    const target = this.getLandingTarget()
    if (!target) return 0
    const landingCell = this.findLandingCell(transport, target)
    if (!landingCell) return 0

    const groupSize = Math.min(NAVAL_TRANSPORT_GROUP_MAX, transport.transportCapacity, availableMilitary.length)
    if (groupSize < NAVAL_TRANSPORT_GROUP_MIN) return 0
    const group = availableMilitary.slice(0, groupSize)
    let loadPlan = null
    for (const unit of group) {
      const shoreCell = findLoadShoreCell(unit, transport)
      const coastCell = findTransportCoastCell(transport, shoreCell)
      if (shoreCell && coastCell) {
        loadPlan = { shoreCell, coastCell }
        break
      }
    }
    if (!loadPlan) return 0

    transport.sendTo(loadPlan.coastCell)
    for (const unit of group) {
      unit.assault = true
      unit.transportLoadShoreCell = loadPlan.shoreCell
      unit.transportLoadCoastCell = loadPlan.coastCell
      unit.sendToWithCell(transport, loadPlan.shoreCell, ACTION_TYPES.loadTransport)
    }
    const groupLabels = new Set(group.map(unit => unit.label))
    for (let index = availableMilitary.length - 1; index >= 0; index--) {
      if (groupLabels.has(availableMilitary[index].label)) availableMilitary.splice(index, 1)
    }
    ai.navalOperation = {
      stage: 'loading',
      startedAt: ai.getNow(),
      transportLabel: transport.label,
      unitLabels: group.map(unit => unit.label),
      targetLabel: target.label,
      landingCell: { i: landingCell.i, j: landingCell.j },
      loadShoreCell: { i: loadPlan.shoreCell.i, j: loadPlan.shoreCell.j },
      loadCoastCell: { i: loadPlan.coastCell.i, j: loadPlan.coastCell.j },
    }
    if (debug) console.log('Starting naval transport operation:', group.length, 'units')
    return 1
  }

  handleActions({ waitingMilitary, inactifMilitary, howManySoldiersBeforeAttack, debug = false }) {
    const { ai } = this
    const { difficultyConfig } = this.strategy
    let actions = 0

    const availableMilitary = [...waitingMilitary]

    actions += this.handleActiveNavalOperation(debug)
    actions += this.maybeStartNavalTransportAttack(availableMilitary, debug)

    const defenseTargets = this.getDefenseTargets()
    if (defenseTargets.length > 0 && availableMilitary.length > 0) {
      const urgentThreat = defenseTargets[0].memory.instance
      if (urgentThreat) {
        const requiredDefensePower = this.getDefenseResponsePower(urgentThreat)
        const defenders = []
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
        const defenderLabels = new Set(defenders.map(unit => unit.label))
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

    if (ai.navalOperation || ai.strategy.needsNavalTransport(availableMilitary.length)) {
      return actions
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
          .getFreshEnemyInstances({ family: FAMILY_TYPES.unit, freshWithin: 25000 })
          .find(u => u.hitPoints > 0 && u.type === UNIT_TYPES.villager && ai.isEnemy(u.owner)) ||
        this.getBestEnemyTarget(availableMilitary)
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
        if (this.canCommitToTarget(attackers, target, 0.65, 1.15)) {
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

      if (canRejoinAttack) {
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
