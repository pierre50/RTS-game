import { Player } from './player'

import {
  getPositionInGridAroundInstance,
  getClosestInstance,
  instancesDistance,
  canAfford,
  findInstancesInSight,
  isPlayerEliminated,
} from '../../lib'
import { ACTION_TYPES, FAMILY_TYPES, PLAYER_TYPES, UNIT_TYPES, BUILDING_TYPES, RESOURCE_TYPES } from '../../constants'
import { AIStrategy } from '../../ai/AIStrategy'
import { AIEconomy } from '../../ai/AIEconomy'
import { classifyMilitaryUnits, isAliveUnit } from '../../ai/unitGroups'

const DEBUG = false

export class AI extends Player {
  constructor({ ...props }, context) {
    super({ ...props, isPlayed: false, type: PLAYER_TYPES.ai }, context)
    this.foundedTrees = new Set()
    this.foundedBerrybushs = new Set()
    this.foundedGolds = new Set()
    this.foundedStones = new Set()
    this.foundedAnimals = new Set()
    this.foundedDeadAnimals = new Set()
    this.foundedFish = new Set()
    this.foundedEnemyBuildings = new Set()
    this.foundedEnemyUnits = new Set()
    this.enemyUnitMemory = new Map()
    this.enemyBuildingMemory = new Map()
    this.difficulty = props.difficulty || 'medium'
    this.strategy = new AIStrategy(this, this.difficulty)
    this.economy = new AIEconomy(this)
    this.strategy.applyConfig(this)
    this.stepDelay = this.difficultyConfig.stepDelayBase
    this._scheduleStep()
    this.selectedUnits = []
    this.selectedUnit = null
    this.selectedBuilding = null
    this.selectedOther = null
    this.scout = null
    this.phase = 'economy' // economy | military_build | attack
    this.threatenedTargets = new Map()
    this.lastAttackWaveAt = -Infinity
  }

  getNow() {
    return this.context.scheduler?.elapsedMs || 0
  }

  rememberEnemy(enemy) {
    if (!enemy?.label || !this.isEnemy(enemy.owner)) return
    const memoryMap = enemy.family === FAMILY_TYPES.building ? this.enemyBuildingMemory : this.enemyUnitMemory
    const visible = Boolean(this.views?.[enemy.i]?.[enemy.j]?.viewBy?.size)
    memoryMap.set(enemy.label, {
      instance: enemy,
      label: enemy.label,
      ownerLabel: enemy.owner?.label,
      family: enemy.family,
      type: enemy.type,
      i: enemy.i,
      j: enemy.j,
      hitPoints: enemy.hitPoints,
      totalHitPoints: enemy.totalHitPoints,
      lastSeenAt: this.getNow(),
      visible,
    })
  }

  _refreshEnemyMemory(memoryMap) {
    const now = this.getNow()
    for (const [label, memory] of memoryMap) {
      const enemy = memory.instance
      if (!enemy || enemy.isDead || enemy.isDestroyed || enemy.hitPoints <= 0 || !this.isEnemy(enemy.owner)) {
        memoryMap.delete(label)
        continue
      }
      const visible = Boolean(this.views?.[enemy.i]?.[enemy.j]?.viewBy?.size)
      if (visible) {
        memory.i = enemy.i
        memory.j = enemy.j
        memory.hitPoints = enemy.hitPoints
        memory.totalHitPoints = enemy.totalHitPoints
        memory.lastSeenAt = now
      } else if (now - memory.lastSeenAt > 90000) {
        memoryMap.delete(label)
        continue
      }
      memory.visible = visible
    }
  }

  getEnemyMemories({ family = null, freshWithin = Infinity, visibleOnly = false } = {}) {
    const now = this.getNow()
    const sources = []
    if (!family || family === FAMILY_TYPES.unit) sources.push(...this.enemyUnitMemory.values())
    if (!family || family === FAMILY_TYPES.building) sources.push(...this.enemyBuildingMemory.values())
    return sources.filter(memory => {
      if (!memory?.instance) return false
      if (visibleOnly && !memory.visible) return false
      return now - memory.lastSeenAt <= freshWithin
    })
  }

  getFreshEnemyInstances(options = {}) {
    return this.getEnemyMemories(options).map(memory => memory.instance)
  }

  reportThreat(target, attacker) {
    if (!target || target.owner?.label !== this.label || !attacker || attacker.isDead || attacker.isDestroyed) return

    const now = this.getNow()
    const key = target.label
    const existing = this.threatenedTargets.get(key)

    this.threatenedTargets.set(key, {
      target,
      lastSeenAt: now,
      attacker,
      attackerFamily: attacker.family,
      attackerType: attacker.type,
      count: (existing?.count || 0) + 1,
    })

    if (attacker.owner && this.isEnemy(attacker.owner)) {
      this.rememberEnemy(attacker)
    }

    if (this._stepTaskId && this.stepDelay !== this.difficultyConfig.stepDelayBase) {
      this.stepDelay = this.difficultyConfig.stepDelayBase
      this.context.scheduler.update(this._stepTaskId, this.stepDelay)
    }
  }

  cleanupThreats() {
    const now = this.getNow()
    for (const [key, threat] of this.threatenedTargets) {
      const target = threat.target
      if (!target || target.isDead || target.isDestroyed || target.owner?.label !== this.label) {
        this.threatenedTargets.delete(key)
        continue
      }

      const hostiles = this.getVisibleHostilesNear(target)
      if (hostiles.length > 0) {
        threat.lastSeenAt = now
        threat.attacker = hostiles[0]
        threat.attackerFamily = hostiles[0].family
        threat.attackerType = hostiles[0].type
        continue
      }

      if (now - threat.lastSeenAt > 8000) {
        this.threatenedTargets.delete(key)
      }
    }
  }

  getVisibleHostilesNear(target, radius = 10) {
    return findInstancesInSight({ i: target.i, j: target.j, sight: radius, context: this.context }, instance => {
      if (!instance || instance === target || instance.isDead || instance.isDestroyed || instance.hitPoints <= 0) {
        return false
      }
      if (instance.family === FAMILY_TYPES.animal) {
        return (
          instance.strategy === 'attack' ||
          instance.action === ACTION_TYPES.attack ||
          instance.dest?.owner?.label === this.label
        )
      }
      return this.isEnemy(instance.owner)
    })
  }

  isBuildingThreatened(building) {
    const threat = this.threatenedTargets.get(building?.label)
    if (!threat) return false
    if (!building || building.isDead || building.isDestroyed) return false
    return this.getNow() - threat.lastSeenAt <= 8000
  }

  getActiveThreats() {
    this.cleanupThreats()
    return [...this.threatenedTargets.values()]
      .filter(threat => threat?.target && !threat.target.isDead && !threat.target.isDestroyed)
      .map(threat => {
        const hostiles = this.getVisibleHostilesNear(threat.target)
        const profile = this.getThreatProfile({ ...threat, hostiles })
        return { ...threat, hostiles, profile }
      })
      .filter(threat => threat.target && threat.hostiles.length > 0)
      .sort((a, b) => b.profile.priority - a.profile.priority)
  }

  getHomeAnchor() {
    const townCenters = this.buildingsByTypes([BUILDING_TYPES.townCenter]).filter(
      building => !building.isDead && !building.isDestroyed
    )
    if (townCenters.length > 0) return townCenters[0]

    const fallbackBuilding = this.buildings.find(building => !building.isDead && !building.isDestroyed)
    if (fallbackBuilding) return fallbackBuilding

    const fallbackVillager = this.units.find(unit => unit.type === UNIT_TYPES.villager && !unit.isDead)
    return fallbackVillager || null
  }

  getThreatProfile(threat) {
    const military = this.strategy.military
    const homeAnchor = this.getHomeAnchor()
    const hostileUnits = threat.hostiles.filter(hostile => hostile.family === FAMILY_TYPES.unit)
    const hostileMilitary = hostileUnits.filter(hostile => hostile.type !== UNIT_TYPES.villager)
    const hostileVillagers = hostileUnits.filter(hostile => hostile.type === UNIT_TYPES.villager)
    const hostileAnimals = threat.hostiles.filter(hostile => hostile.family === FAMILY_TYPES.animal)
    const hostilePower = military.getGroupCombatPower(threat.hostiles)
    const targetDistanceToHome = homeAnchor
      ? Math.abs(threat.target.i - homeAnchor.i) + Math.abs(threat.target.j - homeAnchor.j)
      : Infinity
    const targetIsTownCenter = threat.target.type === BUILDING_TYPES.townCenter
    const targetIsBuilding = threat.target.family === FAMILY_TYPES.building
    const targetIsVillager = threat.target.type === UNIT_TYPES.villager
    const homeThreatRadius = this.difficultyConfig.homeThreatRadius || 15
    const villageCoreRadius = Math.min(homeThreatRadius, this.difficultyConfig.villageCoreRadius || 10)
    const isNearHome = targetDistanceToHome <= homeThreatRadius
    const isInVillageCore = targetDistanceToHome <= villageCoreRadius
    const isRemoteVillagerIncident = targetIsVillager && !isNearHome
    const isDirectVillageAssault =
      hostileMilitary.length > 0 && (targetIsTownCenter || targetIsBuilding || isInVillageCore)
    const isSeriousMilitaryThreat =
      hostileMilitary.length > 0 &&
      (isNearHome || hostilePower >= (this.difficultyConfig.assaultRecallThreshold || 16) * 0.85)

    let priority = hostilePower + threat.hostiles.length * 2 + threat.count
    if (targetIsTownCenter) priority += 16
    else if (targetIsBuilding) priority += 9
    else if (targetIsVillager) priority += 2

    if (isNearHome) priority += 10
    if (isInVillageCore) priority += 7
    if (hostileMilitary.length > 0) priority += 12 + hostileMilitary.length * 4
    else if (hostileVillagers.length > 0) priority += 4 + hostileVillagers.length * 2
    else if (hostileAnimals.length > 0) priority -= 4
    if (isRemoteVillagerIncident && hostileMilitary.length === 0) priority -= 6

    const shouldRecallAssaultUnits =
      isDirectVillageAssault ||
      (isSeriousMilitaryThreat &&
        hostilePower >= (this.difficultyConfig.assaultRecallThreshold || 16) &&
        !isRemoteVillagerIncident)

    return {
      hostileUnits,
      hostileMilitary,
      hostileVillagers,
      hostileAnimals,
      hostilePower,
      isNearHome,
      isInVillageCore,
      isRemoteVillagerIncident,
      isDirectVillageAssault,
      isSeriousMilitaryThreat,
      targetDistanceToHome,
      isCriticalBuilding: targetIsTownCenter,
      isBuilding: targetIsBuilding,
      shouldRecallAssaultUnits,
      priority,
    }
  }

  getDefensePowerNeed(profile) {
    if (!profile) return 0

    if (profile.hostileMilitary.length > 0) {
      const powerRatio = this.difficultyConfig.assaultRecallPowerRatio || 0.85
      const baseNeed = Math.max(6, profile.hostilePower * powerRatio)
      if (profile.isDirectVillageAssault) return baseNeed * 1.15
      if (profile.isRemoteVillagerIncident) return baseNeed * 0.75
      return profile.isCriticalBuilding ? baseNeed * 1.15 : baseNeed
    }

    if (profile.hostileVillagers.length > 0) {
      if (profile.isRemoteVillagerIncident) {
        return Math.max(2, profile.hostileVillagers.length * 1.5)
      }
      return Math.max(3, profile.hostileVillagers.length * 2.5)
    }

    if (profile.hostileAnimals.length > 0) {
      if (profile.isRemoteVillagerIncident) {
        return Math.min(3, Math.max(1, profile.hostileAnimals.length))
      }
      return Math.min(5, Math.max(1.5, profile.hostileAnimals.length * 1.25))
    }

    return 0
  }

  getRecallableAssaultMilitary(assaultMilitary, assignedMilitary, threat) {
    const recallMaxRatio = this.difficultyConfig.assaultRecallMaxRatio || 0.5
    const minAssaultGroup = Math.max(2, Math.ceil(this.difficultyConfig.attackThreshold * 0.6))
    const availableAssault = assaultMilitary
      .filter(unit => !assignedMilitary.has(unit.label))
      .sort(
        (a, b) =>
          Math.abs(a.i - threat.target.i) +
          Math.abs(a.j - threat.target.j) -
          (Math.abs(b.i - threat.target.i) + Math.abs(b.j - threat.target.j))
      )

    if (availableAssault.length <= minAssaultGroup) return []

    const maxRecallByRatio = Math.max(1, Math.floor(availableAssault.length * recallMaxRatio))
    const maxRecallKeepingPressure = Math.max(0, availableAssault.length - minAssaultGroup)
    const maxRecall = Math.min(maxRecallByRatio, maxRecallKeepingPressure)
    return maxRecall > 0 ? availableAssault.slice(0, maxRecall) : []
  }

  handleThreatResponses({ villagers, waitingMilitary, assaultMilitary, debug = false }) {
    const threats = this.getActiveThreats()
    if (!threats.length) return 0

    let actions = 0
    const assignedMilitary = new Set()
    const assignedVillagers = new Set()

    for (const threat of threats) {
      if (!threat.target) continue

      const primaryHostile = threat.hostiles[0]
      if (!primaryHostile) continue

      const profile = threat.profile || this.getThreatProfile(threat)
      const hostileVillagers = profile.hostileVillagers
      const hostileMilitary = profile.hostileMilitary
      const hostileAnimals = profile.hostileAnimals
      const lethalThreat = hostileMilitary.length > 0
      const responseRadius = profile.isCriticalBuilding
        ? 18
        : profile.isDirectVillageAssault
          ? 14
          : profile.isRemoteVillagerIncident
            ? hostileAnimals.length > 0
              ? 4
              : 6
            : profile.isNearHome
              ? 12
              : 10

      const nearbyMilitary = waitingMilitary
        .filter(unit => !assignedMilitary.has(unit.label))
        .sort(
          (a, b) =>
            Math.abs(a.i - threat.target.i) +
            Math.abs(a.j - threat.target.j) -
            (Math.abs(b.i - threat.target.i) + Math.abs(b.j - threat.target.j))
        )

      const desiredDefensePower = this.getDefensePowerNeed(profile)
      const chosenMilitary = []
      let defensePower = 0

      for (const soldier of nearbyMilitary) {
        chosenMilitary.push(soldier)
        defensePower += this.strategy.military.getCombatPower(soldier)
        if (defensePower >= desiredDefensePower) break
      }

      if (profile.shouldRecallAssaultUnits && defensePower < desiredDefensePower) {
        const recallCandidates = this.getRecallableAssaultMilitary(assaultMilitary, assignedMilitary, threat)
        for (const soldier of recallCandidates) {
          chosenMilitary.push(soldier)
          defensePower += this.strategy.military.getCombatPower(soldier)
          if (defensePower >= desiredDefensePower) break
        }
      }

      for (const soldier of chosenMilitary) {
        assignedMilitary.add(soldier.label)
        soldier.sendTo(primaryHostile, ACTION_TYPES.attack)
      }

      const nearbyVillagers = villagers
        .filter(villager => {
          if (assignedVillagers.has(villager.label) || villager === this.scout || villager.isDead) return false
          if (villager.hitPoints <= villager.totalHitPoints * 0.35) return false
          const distance = Math.abs(villager.i - threat.target.i) + Math.abs(villager.j - threat.target.j)
          return distance <= responseRadius
        })
        .sort(
          (a, b) =>
            Math.abs(a.i - threat.target.i) +
            Math.abs(a.j - threat.target.j) -
            (Math.abs(b.i - threat.target.i) + Math.abs(b.j - threat.target.j))
        )

      const buildersOnSite = nearbyVillagers.filter(villager => villager.dest?.label === threat.target.label)
      let villagerDefenseCount = 0

      if (!lethalThreat) {
        if (hostileAnimals.length > 0) {
          villagerDefenseCount =
            hostileAnimals.length === 1
              ? 1
              : Math.min(
                  profile.isCriticalBuilding ? 4 : profile.isRemoteVillagerIncident ? 2 : 3,
                  hostileAnimals.length
                )
        }
        if (hostileVillagers.length > 0) {
          const criticalBonus = profile.isCriticalBuilding ? 2 : 0
          const remotePenalty = profile.isRemoteVillagerIncident ? 2 : 0
          const maxDefense = profile.isCriticalBuilding ? 8 : Math.max(2, 6 - remotePenalty)
          villagerDefenseCount = Math.max(
            villagerDefenseCount,
            Math.min(maxDefense, hostileVillagers.length + criticalBonus)
          )
        }
      }

      const alreadyCovered = chosenMilitary.length
      const missingDefenders = Math.max(0, villagerDefenseCount - alreadyCovered)
      const chosenVillagers = nearbyVillagers.slice(0, missingDefenders)

      for (const villager of chosenVillagers) {
        assignedVillagers.add(villager.label)
        if (primaryHostile.family === FAMILY_TYPES.animal) {
          villager.sendToHunt(primaryHostile)
        } else {
          villager.sendToAttack(primaryHostile)
        }
      }

      const evacVillagers = buildersOnSite.filter(villager => !assignedVillagers.has(villager.label))
      const shouldEvacuateNearbyVillagers = lethalThreat && (profile.isNearHome || profile.isDirectVillageAssault)
      const nearbyWorkersToEvacuate = shouldEvacuateNearbyVillagers
        ? nearbyVillagers.filter(
            villager => !assignedVillagers.has(villager.label) && villager.dest?.label !== threat.target.label
          )
        : []
      for (const villager of nearbyWorkersToEvacuate) {
        assignedVillagers.add(villager.label)
        villager.runaway(primaryHostile)
      }
      for (const villager of evacVillagers) {
        assignedVillagers.add(villager.label)
        villager.runaway(primaryHostile)
      }

      if (debug) {
        console.log(
          'Threat response:',
          threat.target.type,
          'hostiles=',
          threat.hostiles.length,
          'priority=',
          Math.round(profile.priority),
          'military=',
          chosenMilitary.length,
          'villagers=',
          chosenVillagers.length,
          'fallback=',
          nearbyWorkersToEvacuate.length,
          'evac=',
          evacVillagers.length
        )
      }

      if (chosenMilitary.length || chosenVillagers.length || nearbyWorkersToEvacuate.length || evacVillagers.length) {
        actions++
      }
    }

    return actions
  }

  _scheduleStep() {
    this._stepTaskId = this.context.scheduler.add(() => {
      const actions = this.step()
      const newDelay =
        actions > 0 ? this.difficultyConfig.stepDelayBase : Math.min(Math.round(this.stepDelay * 1.5), 5000)
      if (newDelay !== this.stepDelay) {
        this.stepDelay = newDelay
        this.context.scheduler.update(this._stepTaskId, newDelay)
      }
    }, this.stepDelay)
  }

  hasNotReachBuildingLimit(buildingType, buildings) {
    return (
      !this.maxBuildingByAge[this.age][buildingType] || buildings.length < this.maxBuildingByAge[this.age][buildingType]
    )
  }

  buildingsByTypes(types) {
    return this.buildings.filter(b => types.includes(b.type))
  }

  getStrategySnapshot(state) {
    return {
      map: state.map,
      otherPlayers: this.enemyPlayers(),
      villagers: state.villagers,
      maxVillagers: state.maxVillagers,
      towncenters: this.buildingsByTypes([BUILDING_TYPES.townCenter]),
      infantry: state.infantry,
      maxInfantry: state.maxInfantry,
      barracks: this.buildingsByTypes([BUILDING_TYPES.barracks]),
      infantryUnit: state.infantryUnit,
      archers: state.archers,
      maxArcher: state.maxArcher,
      archeryRanges: this.buildingsByTypes([BUILDING_TYPES.archeryRange]),
      archerUnit: state.archerUnit,
      cavalry: state.cavalry,
      maxCavalry: state.maxCavalry,
      stables: this.buildingsByTypes([BUILDING_TYPES.stable]),
      hoplites: state.hoplites,
      maxHoplite: state.maxHoplite,
      academies: this.buildingsByTypes([BUILDING_TYPES.academy]),
      houses: this.buildingsByTypes([BUILDING_TYPES.house]),
      farms: this.buildingsByTypes([BUILDING_TYPES.farm]),
      granarys: this.buildingsByTypes([BUILDING_TYPES.granary]),
      storagepits: this.buildingsByTypes([BUILDING_TYPES.storagePit]),
      markets: this.buildingsByTypes([BUILDING_TYPES.market]),
      governmentCenters: this.buildingsByTypes([BUILDING_TYPES.governmentCenter]),
      watchTowers: this.buildingsByTypes([BUILDING_TYPES.watchTower]),
      sentryTowers: this.buildingsByTypes([BUILDING_TYPES.sentryTower]),
      notBuiltHouses: state.notBuiltHouses,
    }
  }

  // Remove depleted resources and destroyed buildings from tracked Sets
  cleanupSets() {
    for (const r of this.foundedTrees) {
      if (r.quantity <= 0 || r.isDead) this.foundedTrees.delete(r)
    }
    for (const r of this.foundedBerrybushs) {
      if (r.quantity <= 0 || r.isDead) this.foundedBerrybushs.delete(r)
    }
    for (const r of this.foundedStones) {
      if (r.quantity <= 0 || r.isDead) this.foundedStones.delete(r)
    }
    for (const r of this.foundedGolds) {
      if (r.quantity <= 0 || r.isDead) this.foundedGolds.delete(r)
    }
    for (const a of this.foundedAnimals) {
      if (a.isDead || a.isDestroyed || a.hitPoints <= 0) this.foundedAnimals.delete(a)
    }
    for (const a of this.foundedDeadAnimals) {
      if (a.isDestroyed || a.quantity <= 0) this.foundedDeadAnimals.delete(a)
    }
    for (const r of this.foundedFish) {
      if (r.quantity <= 0 || r.isDead) this.foundedFish.delete(r)
    }
    for (const b of this.foundedEnemyBuildings) {
      if (b.isDead || b.isDestroyed || !this.isEnemy(b.owner)) this.foundedEnemyBuildings.delete(b)
    }
    for (const u of this.foundedEnemyUnits) {
      if (u.isDead || u.isDestroyed || u.hitPoints <= 0 || !this.isEnemy(u.owner)) this.foundedEnemyUnits.delete(u)
    }
    this._refreshEnemyMemory(this.enemyBuildingMemory)
    this._refreshEnemyMemory(this.enemyUnitMemory)
  }

  getUnitExtraOptions(type) {
    const me = this
    const options = {
      handleSetDest: target => {
        const { map } = me.context
        if (type === UNIT_TYPES.villager && target.family === FAMILY_TYPES.resource) {
          const buildingType =
            target.type === RESOURCE_TYPES.berrybush ? BUILDING_TYPES.granary : BUILDING_TYPES.storagePit
          const buildings = me.buildingsByTypes([buildingType])
          if (
            canAfford(me, me.config.buildings[buildingType].cost) &&
            me.hasNotReachBuildingLimit(buildingType, buildings)
          ) {
            const closestBuilding = getClosestInstance(target, [
              ...buildings,
              ...me.buildingsByTypes([BUILDING_TYPES.townCenter]),
            ])
            if (!closestBuilding || instancesDistance(closestBuilding, target) > 5) {
              const pos = getPositionInGridAroundInstance(target, map.grid, [1, 5], 1)
              if (pos && me.buyBuilding(pos.i, pos.j, buildingType)) {
                if (DEBUG) console.log(`Building ${buildingType} at:`, pos)
              }
            }
          }
        }
      },
    }
    if (type === UNIT_TYPES.villager) {
      options.handleIsAttacked = (attacker, unit) => {
        const currentDest = unit.dest

        if (attacker.family !== FAMILY_TYPES.animal) {
          unit.runaway(attacker)
          return true
        }

        if (attacker.meleeAttack) {
          const unitHpRatio = unit.hitPoints / unit.totalHitPoints
          const attackerHpRatio = attacker.hitPoints / attacker.totalHitPoints
          const shouldRunAway = unitHpRatio <= 0.3 && attackerHpRatio > 0.4

          if (shouldRunAway) {
            unit.runaway(attacker)
          } else {
            unit.sendToHunt(attacker)
            unit.previousDest = currentDest
          }
          return true
        }
        return false
      }
    }
    return options
  }

  canResearchTech(techKey) {
    return this.strategy.canResearchTech(techKey)
  }

  getBestInfantryUnit() {
    return this.strategy.getBestInfantryUnit()
  }

  getBestArcherUnit() {
    return this.strategy.getBestArcherUnit()
  }

  getLivingUnitsByType(type) {
    return this.units.filter(unit => unit.type === type && isAliveUnit(unit))
  }

  step() {
    const { map, paused, aiPaused } = this.context
    if (paused || aiPaused) return 0

    let actions = 0

    const maxVillagers = Math.floor(this.maxVillagerPerAge[this.age] * this.difficultyConfig.popCapMultiplier)
    const maxInfantry = this.maxInfantryByAge[this.age]
    const maxArcher = this.maxArcherByAge[this.age]
    const maxCavalry = this.maxCavalryByAge[this.age]
    const maxHoplite = this.maxHopliteByAge[this.age]
    const infantryUnit = this.getBestInfantryUnit()
    const archerUnit = this.getBestArcherUnit()
    const howManySoldiersBeforeAttack = this.difficultyConfig.attackThreshold

    if (DEBUG) {
      console.log('----Step started')
      console.log(
        `Age: ${this.age}, Wood: ${this.wood}, Food: ${this.food}, Stone: ${this.stone}, Gold: ${this.gold}, Population: ${this.population}/${this.population_max}`
      )
    }

    const villagers = this.getLivingUnitsByType(UNIT_TYPES.villager)
    const { infantry, archers, cavalry, hoplites } = classifyMilitaryUnits(this.units)
    const military = [...infantry, ...archers, ...cavalry, ...hoplites]
    const militaryPower = this.strategy.military.getGroupCombatPower(military)

    if (DEBUG)
      console.log(
        `Villagers: ${villagers.length}/${maxVillagers}, Infantry: ${infantry.length}/${maxInfantry} (${infantryUnit}), Archers: ${archers.length}/${maxArcher} (${archerUnit}), Cavalry: ${cavalry.length}/${maxCavalry}, Hoplites: ${hoplites.length}/${maxHoplite}, Power: ${Math.round(militaryPower)}`
      )

    const previousPhase = this.phase
    this.strategy.updatePhase(villagers.length, military.length, militaryPower)
    if (DEBUG && previousPhase !== this.phase) console.log(`Phase: ${previousPhase} → ${this.phase}`)
    if (DEBUG) console.log(`Phase: ${this.phase}`)

    const towncenters = this.buildingsByTypes([BUILDING_TYPES.townCenter])
    const storagepits = this.buildingsByTypes([BUILDING_TYPES.storagePit])
    const houses = this.buildingsByTypes([BUILDING_TYPES.house])
    const granarys = this.buildingsByTypes([BUILDING_TYPES.granary])
    const barracks = this.buildingsByTypes([BUILDING_TYPES.barracks])
    const markets = this.buildingsByTypes([BUILDING_TYPES.market])
    const farms = this.buildingsByTypes([BUILDING_TYPES.farm])
    const archeryRanges = this.buildingsByTypes([BUILDING_TYPES.archeryRange])
    const stables = this.buildingsByTypes([BUILDING_TYPES.stable])
    const academies = this.buildingsByTypes([BUILDING_TYPES.academy])
    const watchTowers = this.buildingsByTypes([BUILDING_TYPES.watchTower])
    const sentryTowers = this.buildingsByTypes([BUILDING_TYPES.sentryTower])
    if (DEBUG)
      console.log(
        `Towncenters: ${towncenters.length}, Houses: ${houses.length}, StoragePits: ${storagepits.length}, Granaries: ${granarys.length}, Barracks: ${barracks.length}, Markets: ${markets.length}`
      )

    const notBuiltBuildings = this.buildings
      .filter(b => !b.isBuilt || (b.hitPoints > 0 && b.hitPoints < b.totalHitPoints))
      .sort((a, b) => (a.type === BUILDING_TYPES.house ? -1 : b.type === BUILDING_TYPES.house ? 1 : 0))
    const notBuiltHouses = notBuiltBuildings.filter(b => b.type === BUILDING_TYPES.house)

    // Retreat: critically injured assault soldiers fall back and stop attacking
    const RETREAT_HP_RATIO = 0.3
    military
      .filter(u => u.assault && u.hitPoints < u.totalHitPoints * RETREAT_HP_RATIO)
      .forEach(u => {
        u.assault = false
        u.stop()
      })

    // Soldiers: those already on assault vs those waiting at base (exclude low-HP from attack pool)
    const inactifMilitary = military.filter(c => c.inactif && c.action !== ACTION_TYPES.attack && c.assault)
    const waitingMilitary = military.filter(
      c =>
        c.inactif &&
        c.action !== ACTION_TYPES.attack &&
        !c.assault &&
        c.hitPoints >= c.totalHitPoints * RETREAT_HP_RATIO
    )
    const assaultMilitary = military.filter(
      c => c.assault && c.hitPoints >= c.totalHitPoints * RETREAT_HP_RATIO && c.action === ACTION_TYPES.attack
    )

    if (DEBUG)
      console.log(
        `Inactif Military: ${inactifMilitary.length}, Waiting Military: ${waitingMilitary.length}, Assault Military: ${assaultMilitary.length}`
      )

    // Player losing condition
    if (isPlayerEliminated(this)) {
      if (DEBUG) console.log('Player can no longer act. Dying...')
      this.die()
      return 0
    }

    // Remove depleted resources and destroyed enemies from tracked sets
    this.cleanupSets()
    this.cleanupThreats()

    actions += this.handleThreatResponses({
      villagers,
      waitingMilitary,
      assaultMilitary,
      debug: DEBUG,
    })

    // Re-filter from the already-small arrays rather than scanning all military again
    const refreshedInactifMilitary = inactifMilitary.filter(u => u.inactif && u.action !== ACTION_TYPES.attack)
    const refreshedWaitingMilitary = waitingMilitary.filter(u => u.inactif && u.action !== ACTION_TYPES.attack)

    actions += this.economy.handleVillagerActions({
      villagers,
      map,
      farms,
      notBuiltBuildings,
      storagepits,
      towncenters,
      debug: DEBUG,
    })

    actions += this.strategy.handleMilitaryActions({
      waitingMilitary: refreshedWaitingMilitary,
      inactifMilitary: refreshedInactifMilitary,
      howManySoldiersBeforeAttack,
      debug: DEBUG,
    })

    const strategySnapshot = this.getStrategySnapshot({
      map,
      villagers,
      maxVillagers,
      infantry,
      maxInfantry,
      infantryUnit,
      archers,
      maxArcher,
      archerUnit,
      cavalry,
      maxCavalry,
      hoplites,
      maxHoplite,
      notBuiltHouses,
    })

    actions += this.strategy.handleProductionActions(strategySnapshot, DEBUG)
    actions += this.strategy.handleBuildingActions(strategySnapshot, DEBUG)
    actions += this.strategy.handleTechnologyActions(strategySnapshot, DEBUG)

    if (DEBUG) console.log('----Step ended')
    return actions
  }

  die() {
    const {
      context: { players },
    } = this
    this.context.scheduler.remove(this._stepTaskId)
    players.splice(players.indexOf(this), 1)
  }
}
