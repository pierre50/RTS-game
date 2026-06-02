import { Player } from './player'

import { getPositionInGridAroundInstance, getClosestInstance, instancesDistance, canAfford } from '../../lib'
import { ACTION_TYPES, FAMILY_TYPES, PLAYER_TYPES, UNIT_TYPES, BUILDING_TYPES, RESOURCE_TYPES } from '../../constants'
import { AIStrategy } from '../../ai/AIStrategy'
import { AIEconomy } from '../../ai/AIEconomy'

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
        if (attacker.family !== FAMILY_TYPES.animal || attacker.meleeAttack) {
          unit.runaway(attacker)
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

  step() {
    const { map, paused } = this.context
    if (paused) return 0

    let actions = 0

    const maxVillagers = Math.floor(this.maxVillagerPerAge[this.age] * this.difficultyConfig.popCapMultiplier)
    const maxVillagersOnConstruction = 2 + this.age * 2
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

    const filterUnitsByType = (type, condition = unit => unit.hitPoints > 0) =>
      this.units.filter(unit => unit.type === type && condition(unit))

    const villagers = filterUnitsByType(UNIT_TYPES.villager)
    const infantry = this.units.filter(
      u =>
        u.hitPoints > 0 && ['Clubman', 'Axeman', 'ShortSwordsman', 'BroadSwordsman', 'LongSwordsman'].includes(u.type)
    )
    const archers = this.units.filter(
      u => u.hitPoints > 0 && ['Bowman', 'ImprovedBowman', 'CompositeBowman'].includes(u.type)
    )
    const cavalry = this.units.filter(u => u.hitPoints > 0 && u.type === 'Scout')
    const hoplites = this.units.filter(u => u.hitPoints > 0 && u.type === 'Hoplite')
    const military = [...infantry, ...archers, ...cavalry, ...hoplites]

    if (DEBUG)
      console.log(
        `Villagers: ${villagers.length}/${maxVillagers}, Infantry: ${infantry.length}/${maxInfantry} (${infantryUnit}), Archers: ${archers.length}/${maxArcher} (${archerUnit}), Cavalry: ${cavalry.length}/${maxCavalry}, Hoplites: ${hoplites.length}/${maxHoplite}`
      )

    const previousPhase = this.phase
    this.strategy.updatePhase(villagers.length, military.length)
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

    if (DEBUG) console.log(`Inactif Military: ${inactifMilitary.length}, Waiting Military: ${waitingMilitary.length}`)

    // Player losing condition
    if (!this.buildings.length && !this.units.length) {
      if (DEBUG) console.log('Player has no buildings and units. Dying...')
      this.die()
      return 0
    }

    // Remove depleted resources and destroyed enemies from tracked sets
    this.cleanupSets()

    // Cache enemy players once — used in multiple building placement filters below
    const otherPlayers = this.enemyPlayers()

    actions += this.economy.handleVillagerActions({
      villagers,
      map,
      farms,
      notBuiltBuildings,
      maxVillagersOnConstruction,
      debug: DEBUG,
    })

    actions += this.strategy.handleMilitaryActions({
      waitingMilitary,
      inactifMilitary,
      howManySoldiersBeforeAttack,
      debug: DEBUG,
    })

    const strategySnapshot = {
      map,
      otherPlayers,
      villagers,
      maxVillagers,
      towncenters,
      infantry,
      maxInfantry,
      barracks,
      infantryUnit,
      archers,
      maxArcher,
      archeryRanges,
      archerUnit,
      cavalry,
      maxCavalry,
      stables,
      hoplites,
      maxHoplite,
      academies,
      houses,
      farms,
      granarys,
      storagepits,
      markets,
      watchTowers,
      sentryTowers,
      notBuiltHouses,
    }

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
