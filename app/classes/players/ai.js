import { Player } from './player'

import {
  getValuePercentage,
  getPositionInGridAroundInstance,
  getClosestInstance,
  instancesDistance,
  canAfford,
  randomRange,
  getCellsAroundPoint,
} from '../../lib'
import {
  WORK_TYPES,
  ACTION_TYPES,
  FAMILY_TYPES,
  PLAYER_TYPES,
  UNIT_TYPES,
  BUILDING_TYPES,
  RESOURCE_TYPES,
} from '../../constants'

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
    const _difficulties = {
      easy:   { stepDelayBase: 6000, popCapMultiplier: 0.7, attackThreshold: 8, defenderRatio: 0.5, econToMilVillagers: 16, raidThreshold: 0, raidSize: 0 },
      medium: { stepDelayBase: 4000, popCapMultiplier: 1.0, attackThreshold: 5, defenderRatio: 0.3, econToMilVillagers: 12, raidThreshold: 0, raidSize: 0 },
      hard:   { stepDelayBase: 2500, popCapMultiplier: 1.3, attackThreshold: 3, defenderRatio: 0.2, econToMilVillagers: 8,  raidThreshold: 4, raidSize: 3 },
    }
    this.difficultyConfig = _difficulties[this.difficulty] || _difficulties.medium
    this.stepDelay = this.difficultyConfig.stepDelayBase
    this._scheduleStep()
    this.selectedUnits = []
    this.selectedUnit = null
    this.selectedBuilding = null
    this.selectedOther = null
    this.scout = null
    this.phase = 'economy' // economy | military_build | attack

    this.nextAge = {
      1: 'ToolAge',
      2: 'BronzeAge',
      3: 'IronAge',
    }
    this.maxVillagerPerAge = {
      0: 16,
      1: 24,
      2: 40,
      3: 50,
    }
    this.villageTargetPercentageByAge = {
      0: {
        wood: 40,
        food: 60,
        gold: 0,
        stone: 0,
      },
      1: {
        wood: 45,
        food: 45,
        gold: 10,
        stone: 0,
      },
      2: {
        wood: 35,
        food: 35,
        gold: 20,
        stone: 10,
      },
      3: {
        wood: 30,
        food: 30,
        gold: 25,
        stone: 15,
      },
    }
    this.maxBuildingByAge = {
      0: {
        StoragePit: 1,
        Granary: 1,
        Barracks: 1,
        Market: 1,
      },
      1: {
        StoragePit: 2,
        Granary: 2,
        Farm: 4,
        Barracks: 1,
        Market: 1,
        ArcheryRange: 1,
        Stable: 1,
        WatchTower: 2,
      },
      2: {
        StoragePit: 3,
        Granary: 3,
        Farm: 6,
        Barracks: 2,
        Market: 1,
        ArcheryRange: 1,
        Stable: 1,
        Academy: 1,
        WatchTower: 3,
        SentryTower: 2,
      },
      3: {
        StoragePit: 4,
        Granary: 4,
        Farm: 10,
        Barracks: 2,
        Market: 1,
        ArcheryRange: 2,
        Stable: 1,
        Academy: 1,
        WatchTower: 3,
        SentryTower: 3,
      },
    }
    this.maxInfantryByAge = { 0: 8, 1: 8,  2: 10, 3: 12 }
    this.maxArcherByAge   = { 0: 0, 1: 4,  2: 6,  3: 8  }
    this.maxCavalryByAge  = { 0: 0, 1: 3,  2: 4,  3: 5  }
    this.maxHopliteByAge  = { 0: 0, 1: 0,  2: 2,  3: 4  }
    // Priority-ordered tech lists per building type — AI tries them each step and skips if conditions unmet or already researched
    this.techPriorityByBuilding = {
      [BUILDING_TYPES.barracks]:      ['BattleAxe', 'ShortSword', 'BroadSword', 'LongSword'],
      [BUILDING_TYPES.archeryRange]:  ['ImprovedBow', 'CompositeBow'],
      [BUILDING_TYPES.storagePit]: [
        'Toolworking', 'LeatherArmorInfantry', 'Metalworking', 'ScaleArmorInfantry',
        'Metallurgy', 'ChainmailInfantry', 'BronzeShield', 'IronShield',
      ],
      [BUILDING_TYPES.market]: ['Woodworking', 'GoldMining', 'StoneMining', 'Domestication'],
      [BUILDING_TYPES.granary]: ['ResearchWatchTower', 'ResearchSentryTower'],
    }
  }

  _scheduleStep() {
    this._stepTaskId = this.context.scheduler.add(() => {
      const actions = this.step()
      const newDelay = actions > 0
        ? this.difficultyConfig.stepDelayBase
        : Math.min(Math.round(this.stepDelay * 1.5), 5000)
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
      if (b.isDead || b.isDestroyed) this.foundedEnemyBuildings.delete(b)
    }
    for (const u of this.foundedEnemyUnits) {
      if (u.isDead || u.isDestroyed || u.hitPoints <= 0) this.foundedEnemyUnits.delete(u)
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
        if (attacker.family !== FAMILY_TYPES.animal) {
          unit.runaway(attacker)
          return true
        }
        return false
      }
    }
    return options
  }

  canResearchTech(techKey) {
    const tech = this.techs[techKey]
    if (!tech?.conditions) return true
    return tech.conditions.every(cond => {
      if (cond.key === 'age') {
        if (cond.op === '>=') return this.age >= cond.value
        if (cond.op === '=') return this.age === cond.value
      }
      if (cond.key === 'technologies') {
        if (cond.op === 'includes') return this.technologies.includes(cond.value)
        if (cond.op === 'notincludes') return !this.technologies.includes(cond.value)
      }
      return true
    })
  }

  getBestInfantryUnit() {
    if (this.technologies.includes('LongSword')) return 'LongSwordsman'
    if (this.technologies.includes('BroadSword')) return 'BroadSwordsman'
    if (this.technologies.includes('ShortSword')) return 'ShortSwordsman'
    if (this.technologies.includes('BattleAxe')) return 'Axeman'
    return 'Clubman'
  }

  getBestArcherUnit() {
    if (this.technologies.includes('CompositeBow')) return 'CompositeBowman'
    if (this.technologies.includes('ImprovedBow')) return 'ImprovedBowman'
    return 'Bowman'
  }

  step() {
    const { map, paused } = this.context
    if (paused) return 0

    let actions = 0

    const maxVillagers = Math.floor(this.maxVillagerPerAge[this.age] * this.difficultyConfig.popCapMultiplier)
    const maxVillagersOnConstruction = 2 + this.age * 2
    const maxInfantry = this.maxInfantryByAge[this.age]
    const maxArcher   = this.maxArcherByAge[this.age]
    const maxCavalry  = this.maxCavalryByAge[this.age]
    const maxHoplite  = this.maxHopliteByAge[this.age]
    const infantryUnit = this.getBestInfantryUnit()
    const archerUnit   = this.getBestArcherUnit()
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
    const infantry = this.units.filter(u => u.hitPoints > 0 && ['Clubman', 'Axeman', 'ShortSwordsman', 'BroadSwordsman', 'LongSwordsman'].includes(u.type))
    const archers  = this.units.filter(u => u.hitPoints > 0 && ['Bowman', 'ImprovedBowman', 'CompositeBowman'].includes(u.type))
    const cavalry  = this.units.filter(u => u.hitPoints > 0 && u.type === 'Scout')
    const hoplites = this.units.filter(u => u.hitPoints > 0 && u.type === 'Hoplite')
    const military = [...infantry, ...archers, ...cavalry, ...hoplites]

    if (DEBUG) console.log(`Villagers: ${villagers.length}/${maxVillagers}, Infantry: ${infantry.length}/${maxInfantry} (${infantryUnit}), Archers: ${archers.length}/${maxArcher} (${archerUnit}), Cavalry: ${cavalry.length}/${maxCavalry}, Hoplites: ${hoplites.length}/${maxHoplite}`)

    // Phase transitions: economy → military_build → attack
    if (this.phase === 'economy' && villagers.length >= this.difficultyConfig.econToMilVillagers) {
      this.phase = 'military_build'
      if (DEBUG) console.log('Phase: economy → military_build')
    }
    if (this.phase === 'military_build' && military.length >= howManySoldiersBeforeAttack) {
      this.phase = 'attack'
      if (DEBUG) console.log('Phase: military_build → attack')
    }
    // Fall back to rebuilding if the army is decimated after a wave
    if (this.phase === 'attack' && military.length < Math.ceil(howManySoldiersBeforeAttack * 0.4)) {
      this.phase = 'military_build'
      if (DEBUG) console.log('Phase: attack → military_build (army depleted)')
    }
    if (DEBUG) console.log(`Phase: ${this.phase}`)

    const towncenters   = this.buildingsByTypes([BUILDING_TYPES.townCenter])
    const storagepits   = this.buildingsByTypes([BUILDING_TYPES.storagePit])
    const houses        = this.buildingsByTypes([BUILDING_TYPES.house])
    const granarys      = this.buildingsByTypes([BUILDING_TYPES.granary])
    const barracks      = this.buildingsByTypes([BUILDING_TYPES.barracks])
    const markets       = this.buildingsByTypes([BUILDING_TYPES.market])
    const farms         = this.buildingsByTypes([BUILDING_TYPES.farm])
    const archeryRanges = this.buildingsByTypes([BUILDING_TYPES.archeryRange])
    const stables       = this.buildingsByTypes([BUILDING_TYPES.stable])
    const academies     = this.buildingsByTypes([BUILDING_TYPES.academy])
    const watchTowers   = this.buildingsByTypes([BUILDING_TYPES.watchTower])
    const sentryTowers  = this.buildingsByTypes([BUILDING_TYPES.sentryTower])
    const emptyFarms = farms.filter(({ isUsedBy }) => !isUsedBy)

    if (DEBUG)
      console.log(
        `Towncenters: ${towncenters.length}, Houses: ${houses.length}, StoragePits: ${storagepits.length}, Granaries: ${granarys.length}, Barracks: ${barracks.length}, Markets: ${markets.length}`
      )

    const notBuiltBuildings = this.buildings
      .filter(b => !b.isBuilt || (b.hitPoints > 0 && b.hitPoints < b.totalHitPoints))
      .sort((a, b) => (a.type === BUILDING_TYPES.house ? -1 : b.type === BUILDING_TYPES.house ? 1 : 0))
    const notBuiltHouses = notBuiltBuildings.filter(b => b.type === BUILDING_TYPES.house)

    const villagersByWork = works => villagers.filter(v => !v.inactif && works.includes(v.work))
    const inactifVillagers = villagers.filter(v => v.inactif && v.action !== ACTION_TYPES.attack)

    // Split food workers by type to avoid stopping farmers when berries run out
    const villagersForaging = villagersByWork([WORK_TYPES.forager])
    const villagersFarming = villagersByWork([WORK_TYPES.farmer])
    const villagersHunting = villagersByWork([WORK_TYPES.hunter])
    const villagersFishing = villagersByWork([WORK_TYPES.fisher])
    const villagersOnFood = [...villagersForaging, ...villagersFarming, ...villagersHunting, ...villagersFishing]
    const villagersOnWood = villagersByWork([WORK_TYPES.woodcutter])
    const villagersOnGold = villagersByWork([WORK_TYPES.goldminer])
    const villagersOnStone = villagersByWork([WORK_TYPES.stoneminer])
    const builderVillagers = villagersByWork([WORK_TYPES.builder])

    const woodBoost = this.wood < 50 ? 15 : 0
    const foodBoost = this.food < 50 ? 15 : 0
    const maxVillagersOnFood = getValuePercentage(villagers.length, this.villageTargetPercentageByAge[this.age]['food'] + foodBoost)
    const maxVillagersOnWood = getValuePercentage(villagers.length, this.villageTargetPercentageByAge[this.age]['wood'] + woodBoost)
    const maxVillagersOnGold = getValuePercentage(villagers.length, this.villageTargetPercentageByAge[this.age]['gold'])
    const maxVillagersOnStone = getValuePercentage(
      villagers.length,
      this.villageTargetPercentageByAge[this.age]['stone']
    )

    if (DEBUG)
      console.log(
        `Food: ${villagersOnFood.length}/${maxVillagersOnFood}, Wood: ${villagersOnWood.length}/${maxVillagersOnWood}, Stone: ${villagersOnStone.length}/${maxVillagersOnStone}, Gold: ${villagersOnGold.length}/${maxVillagersOnGold}, Builders: ${builderVillagers.length}`
      )

    // Retreat: critically injured assault soldiers fall back and stop attacking
    const RETREAT_HP_RATIO = 0.3
    military
      .filter(u => u.assault && u.hitPoints < u.totalHitPoints * RETREAT_HP_RATIO)
      .forEach(u => { u.assault = false; u.stop() })

    // Soldiers: those already on assault vs those waiting at base (exclude low-HP from attack pool)
    const inactifMilitary = military.filter(c => c.inactif && c.action !== ACTION_TYPES.attack && c.assault)
    const waitingMilitary = military.filter(c =>
      c.inactif &&
      c.action !== ACTION_TYPES.attack &&
      !c.assault &&
      c.hitPoints >= c.totalHitPoints * RETREAT_HP_RATIO
    )

    if (DEBUG)
      console.log(`Inactif Military: ${inactifMilitary.length}, Waiting Military: ${waitingMilitary.length}`)

    // Player losing condition
    if (!this.buildings.length && !this.units.length) {
      if (DEBUG) console.log('Player has no buildings and units. Dying...')
      this.die()
      return 0
    }

    // Remove depleted resources and destroyed enemies from tracked sets
    this.cleanupSets()

    // Scout logic: one villager explores the map incrementally.
    // Pick the last idle villager so that earlier ones remain available for gathering.
    // Resources and enemies are discovered naturally through unit sight (updateAIKnowledge in grid.js).
    if (!this.scout || this.scout.isDead || this.scout.hitPoints <= 0) {
      this.scout = inactifVillagers[inactifVillagers.length - 1] || null
    }
    if (this.scout && this.scout.inactif) {
      // explore() finds the nearest unviewed cell (radius 50) — short path, A* always succeeds
      this.scout.explore()
    }

    // Mutable pool of idle villagers — scout excluded so it doesn't get reassigned to gather
    const availableVillagers = inactifVillagers.filter(v => v !== this.scout)

    // Cache otherPlayers once — used in multiple building placement filters below
    const otherPlayers = this.otherPlayers()

    // Assign villagers from the available pool to a resource type.
    // Stops excess workers and fills shortfall from the available pool.
    const assignVillagersToResource = (villagersOnResource, resourceList, maxVillagersForResource, actionCallback) => {
      // Stop workers above quota
      for (let i = maxVillagersForResource; i < villagersOnResource.length; i++) {
        villagersOnResource[i].stop()
      }
      if (resourceList.size === 0) return 0
      const needed = Math.max(0, maxVillagersForResource - villagersOnResource.length)
      const toAssign = Math.min(needed, availableVillagers.length)
      for (let i = 0; i < toAssign; i++) {
        const villager = availableVillagers.shift()
        const resource = getClosestInstance(villager, resourceList)
        actionCallback(villager, resource)
      }
      return toAssign
    }

    // Track food workers assigned this step to avoid double-filling the quota via both berries and farms
    let foodWorkersAssigned = villagersOnFood.length

    // Discover dead animals with remaining meat (scan each step so nothing is missed)
    for (const animal of map.gaia.units) {
      if (animal.isDead && !animal.isDestroyed && animal.quantity > 0) {
        this.foundedDeadAnimals.add(animal)
      }
    }

    // Dead animal meat: highest food priority (free meat, no hunting needed)
    if (this.foundedDeadAnimals.size > 0) {
      const toAssign = Math.min(Math.max(0, maxVillagersOnFood - foodWorkersAssigned), availableVillagers.length)
      for (let i = 0; i < toAssign; i++) {
        const animal = getClosestInstance(availableVillagers[0], this.foundedDeadAnimals)
        if (!animal) break
        availableVillagers.shift().sendToTakeMeat(animal)
        foodWorkersAssigned++
        actions++
      }
    }

    // Food: berries
    const berriesAssigned = assignVillagersToResource(
      villagersForaging,
      this.foundedBerrybushs,
      maxVillagersOnFood,
      (villager, bush) => {
        villager.sendToBerrybush(bush)
      }
    )
    foodWorkersAssigned += berriesAssigned
    actions += berriesAssigned

    // Wood
    actions += assignVillagersToResource(villagersOnWood, this.foundedTrees, maxVillagersOnWood, (villager, tree) => {
      villager.sendToTree(tree)
    })

    // Hunting live animals (before farms, capped at 2 hunters)
    if (this.foundedAnimals.size > 0) {
      const maxHunters = Math.min(2, availableVillagers.length)
      for (let i = 0; i < maxHunters; i++) {
        if (foodWorkersAssigned >= maxVillagersOnFood) break
        const animal = getClosestInstance(availableVillagers[0], this.foundedAnimals)
        if (!animal) break
        availableVillagers.shift().sendToHunt(animal)
        foodWorkersAssigned++
        actions++
      }
    }

    // Food: fishing (capped at 3, only when salmon spotted)
    if (this.foundedFish.size > 0) {
      const maxFishers = Math.min(3, availableVillagers.length)
      for (let i = 0; i < maxFishers; i++) {
        if (foodWorkersAssigned >= maxVillagersOnFood) break
        const fish = getClosestInstance(availableVillagers[0], this.foundedFish)
        if (!fish) break
        availableVillagers.shift().sendToFish(fish)
        foodWorkersAssigned++
        actions++
      }
    }

    // Food fallback: send to empty farms only when other sources aren't covering the full quota
    const foodShortfall = Math.max(0, maxVillagersOnFood - foodWorkersAssigned)
    for (let i = 0; i < emptyFarms.length && i < foodShortfall && availableVillagers.length > 0; i++) {
      const villager = availableVillagers.shift()
      villager.sendToFarm(emptyFarms[i])
      actions++
    }

    // Stone
    actions += assignVillagersToResource(villagersOnStone, this.foundedStones, maxVillagersOnStone, (villager, stone) => {
      villager.sendToStone(stone)
    })

    // Gold
    actions += assignVillagersToResource(villagersOnGold, this.foundedGolds, maxVillagersOnGold, (villager, gold) => {
      villager.sendToGold(gold)
    })

    // Construction
    if (notBuiltBuildings.length) {
      for (const building of notBuiltBuildings) {
        if (builderVillagers.length >= maxVillagersOnConstruction) break
        if (availableVillagers.length === 0) break
        const villager = getClosestInstance(building, availableVillagers)
        if (villager) {
          if (DEBUG) console.log('Villager sent to build:', building)
          villager.sendToBuilding(building)
          availableVillagers.splice(availableVillagers.indexOf(villager), 1)
          actions++
        }
      }
    }

    // Attack helpers
    const sendToAttack = (soldiers, target) => {
      if (DEBUG) console.log('Sending soldiers to attack:', target)
      soldiers.forEach(c => { c.assault = true })

      const { map } = this.context
      const targetCell = map.grid[target.i]?.[target.j]

      // Pre-assign distinct arrival cells so each soldier runs A* exactly once,
      // instead of getInstanceClosestFreeCellPath trying multiple candidates per unit.
      if (soldiers.length > 1 && targetCell?.solid) {
        const size = target.size || (targetCell.has?.size) || 1
        const dist = size === 3 ? 2 : 1
        const candidates = getCellsAroundPoint(target.i, target.j, map.grid, dist,
          cell => !cell.solid && cell.category !== 'Water'
        )
        const taken = new Set()
        for (const soldier of soldiers) {
          let best = null, bestDist = Infinity
          for (const cell of candidates) {
            if (taken.has(cell)) continue
            const d = Math.abs(cell.i - soldier.i) + Math.abs(cell.j - soldier.j)
            if (d < bestDist) { bestDist = d; best = cell }
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

    // Pick the best enemy target (prefer TC, then any building)
    const getBestEnemyTarget = () =>
      [...this.foundedEnemyBuildings].find(b => b.type === BUILDING_TYPES.townCenter) ||
      this.foundedEnemyBuildings.values().next().value

    // Mutable military pool — consumed in priority order: defense → early raid → main wave
    const availableMilitary = [...waitingMilitary]

    // Defense (highest priority): any spotted enemy unit → all idle soldiers react
    if (this.foundedEnemyUnits.size > 0 && availableMilitary.length > 0) {
      const enemyUnit = [...this.foundedEnemyUnits].find(u => u.hitPoints > 0)
      if (enemyUnit) {
        if (DEBUG) console.log('Enemy units spotted! Defending...')
        sendToAttack(availableMilitary.splice(0), enemyUnit)
        actions++
      }
    }

    // Early raid (hard difficulty, military_build phase): harass enemy villagers before the main wave
    const raidThreshold = this.difficultyConfig.raidThreshold
    const raidSize = this.difficultyConfig.raidSize
    if (raidThreshold > 0 && this.phase === 'military_build' && availableMilitary.length >= raidThreshold) {
      const raidTarget =
        [...this.foundedEnemyUnits].find(u => u.hitPoints > 0 && u.type === UNIT_TYPES.villager) ||
        this.foundedEnemyBuildings.values().next().value
      if (raidTarget) {
        if (DEBUG) console.log(`Early raid! Sending ${raidSize} soldiers to harass.`)
        sendToAttack(availableMilitary.splice(0, raidSize), raidTarget)
        actions++
      }
    }

    // Main attack wave (attack phase only): keep a garrison, send the rest
    if (this.phase === 'attack' && availableMilitary.length >= howManySoldiersBeforeAttack) {
      const defenderCount = Math.max(2, Math.floor(availableMilitary.length * this.difficultyConfig.defenderRatio))
      const attackers = availableMilitary.slice(defenderCount)
      if (attackers.length > 0) {
        const target =
          getBestEnemyTarget() ||
          map.grid[randomRange(0, map.grid.length - 1)][randomRange(0, map.grid[0].length - 1)]
        if (DEBUG) console.log(`Launching attack wave! ${attackers.length} attackers, ${defenderCount} defenders. Target:`, target)
        sendToAttack(attackers, target)
        actions++
      }
    }

    // Soldiers that finished an assault → redirect to next enemy building
    if (inactifMilitary.length && this.foundedEnemyBuildings.size) {
      const target = getBestEnemyTarget()
      if (target) {
        if (DEBUG) console.log('Redirecting assault soldiers to:', target)
        sendToAttack(inactifMilitary, target)
        actions++
      }
    }

    // Unit Purchasing
    const buyUnits = (currentCount, maxCount, buildingList, unitType, extra) => {
      const unitsNeeded = maxCount - currentCount
      let unitsBought = 0
      if (unitsNeeded <= 0) return 0
      for (const building of buildingList) {
        if (unitsBought >= unitsNeeded) break
        if (building && building.buyUnit(unitType, false, false, extra)) {
          unitsBought++
          if (DEBUG) console.log(`Buying ${unitType} from ${building.type}, Total Bought: ${unitsBought}`)
        }
      }
      return unitsBought
    }

    actions += buyUnits(villagers.length, maxVillagers, towncenters, UNIT_TYPES.villager)
    actions += buyUnits(infantry.length, maxInfantry, barracks, infantryUnit)
    actions += buyUnits(archers.length,  maxArcher,   archeryRanges, archerUnit)
    actions += buyUnits(cavalry.length,  maxCavalry,  stables, 'Scout')
    actions += buyUnits(hoplites.length, maxHoplite,  academies, 'Hoplite')

    // Building Purchasing — use BUILDING_TYPES constants as keys to avoid string/constant mismatches
    const buyBuildingIfNeeded = (condition, buildingType, positionCallback) => {
      const list = {
        [BUILDING_TYPES.house]: houses,
        [BUILDING_TYPES.farm]: farms,
        [BUILDING_TYPES.barracks]: barracks,
        [BUILDING_TYPES.granary]: granarys,
        [BUILDING_TYPES.storagePit]: storagepits,
        [BUILDING_TYPES.market]: markets,
        [BUILDING_TYPES.archeryRange]: archeryRanges,
        [BUILDING_TYPES.stable]: stables,
        [BUILDING_TYPES.academy]: academies,
        [BUILDING_TYPES.watchTower]: watchTowers,
        [BUILDING_TYPES.sentryTower]: sentryTowers,
      }
      const building = this.config.buildings[buildingType]
      if (
        condition &&
        canAfford(this, building.cost) &&
        this.hasNotReachBuildingLimit(buildingType, list[buildingType])
      ) {
        const pos = positionCallback()
        if (pos && this.buyBuilding(pos.i, pos.j, buildingType)) {
          if (DEBUG) console.log(`Buying building: ${buildingType} at position:`, pos)
          return true
        }
      }
      return false
    }

    // House
    if (buyBuildingIfNeeded(this.population + 2 > this.population_max && !notBuiltHouses.length, BUILDING_TYPES.house, () =>
      getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 10], 0)
    )) actions++

    // Barracks — only once economy phase ends
    if (buyBuildingIfNeeded(this.phase !== 'economy', BUILDING_TYPES.barracks, () =>
      getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 20], 1, false, cell =>
        otherPlayers.every(player => instancesDistance(cell, player) <= instancesDistance(towncenters[0], player))
      )
    )) actions++

    // Market
    if (buyBuildingIfNeeded(markets.length === 0, BUILDING_TYPES.market, () =>
      getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 20], 1, false, cell =>
        otherPlayers.every(player => instancesDistance(cell, player) <= instancesDistance(towncenters[0], player))
      )
    )) actions++

    // Archery Range (conditions checked inside buyBuilding: age >= 1 + hasBuilt Barracks)
    if (buyBuildingIfNeeded(barracks.length > 0, BUILDING_TYPES.archeryRange, () =>
      getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 20], 1, false, cell =>
        otherPlayers.every(player => instancesDistance(cell, player) <= instancesDistance(towncenters[0], player))
      )
    )) actions++

    // Stable (conditions checked inside buyBuilding: age >= 1 + hasBuilt Barracks)
    if (buyBuildingIfNeeded(barracks.length > 0, BUILDING_TYPES.stable, () =>
      getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 20], 1, false, cell =>
        otherPlayers.every(player => instancesDistance(cell, player) <= instancesDistance(towncenters[0], player))
      )
    )) actions++

    // Academy (conditions checked inside buyBuilding: age >= 2 + hasBuilt Stable)
    if (buyBuildingIfNeeded(stables.some(s => s.isBuilt), BUILDING_TYPES.academy, () =>
      getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 20], 1, false, cell =>
        otherPlayers.every(player => instancesDistance(cell, player) <= instancesDistance(towncenters[0], player))
      )
    )) actions++

    // Farm
    if (buyBuildingIfNeeded(true, BUILDING_TYPES.farm, () => {
      const buildings = [...granarys, ...towncenters]
      for (const building of buildings) {
        const position = getPositionInGridAroundInstance(
          building,
          map.grid,
          [2, 10],
          2,
          false,
          cell => otherPlayers.every(player => instancesDistance(cell, player) <= instancesDistance(building, player)),
          false
        )
        if (position) return position
      }
      return null
    })) actions++

    // WatchTower — place on the enemy-facing perimeter once the research is done
    if (buyBuildingIfNeeded(this.technologies.includes('ResearchWatchTower'), BUILDING_TYPES.watchTower, () =>
      getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 15], 2, false, cell =>
        otherPlayers.every(player => instancesDistance(cell, player) <= instancesDistance(towncenters[0], player))
      )
    )) actions++

    // SentryTower — replaces WatchTower role at age 2+
    if (buyBuildingIfNeeded(this.technologies.includes('ResearchSentryTower'), BUILDING_TYPES.sentryTower, () =>
      getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 15], 2, false, cell =>
        otherPlayers.every(player => instancesDistance(cell, player) <= instancesDistance(towncenters[0], player))
      )
    )) actions++

    // Tech / Age Up
    const buyTechnology = (buildingList, technologyType) => {
      let bought = 0
      for (const building of buildingList) {
        if (building && building.buyTechnology(technologyType)) {
          if (DEBUG) console.log(`Buying ${technologyType} from ${building.type}`)
          bought++
        }
      }
      return bought
    }
    // Age up only when near pop cap AND resources cover cost + buffer (avoid stripping the economy)
    const ageUpCosts   = { 1: { food: 500 }, 2: { food: 800 }, 3: { food: 1000, gold: 800 } }
    const ageUpBuffers = { 1: { food: 200 }, 2: { food: 200 }, 3: { food: 200,  gold: 200 } }
    const nextAgeKey = this.age + 1
    if (this.nextAge[nextAgeKey]) {
      const cost   = ageUpCosts[nextAgeKey]   || {}
      const buffer = ageUpBuffers[nextAgeKey] || {}
      const popReady = this.population >= Math.floor(maxVillagers * 0.8)
      const resReady = Object.entries(cost).every(([res, amount]) => this[res] >= amount + (buffer[res] || 0))
      if (popReady && resReady) {
        actions += buyTechnology(towncenters, this.nextAge[nextAgeKey])
      }
    }

    // Research other technologies — one per building type per step, respecting conditions and prereqs
    const buildingListByType = {
      [BUILDING_TYPES.barracks]:     barracks,
      [BUILDING_TYPES.archeryRange]: archeryRanges,
      [BUILDING_TYPES.storagePit]:   storagepits,
      [BUILDING_TYPES.market]:       markets,
      [BUILDING_TYPES.granary]:      granarys,
    }
    for (const [buildingType, techList] of Object.entries(this.techPriorityByBuilding)) {
      const buildings = buildingListByType[buildingType]
      if (!buildings?.length) continue
      for (const tech of techList) {
        if (this.technologies.includes(tech)) continue
        if (!this.canResearchTech(tech)) continue
        const bought = buyTechnology(buildings, tech)
        if (bought) {
          actions += bought
          break
        }
      }
    }

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
