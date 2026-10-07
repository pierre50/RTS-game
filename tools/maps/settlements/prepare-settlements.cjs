const { loadGenerationTs } = require('../load-generation-ts.cjs')
const { prepareSettlementRoads, validateSettlementRoads } = require('./settlement-roads.cjs')
const { settlementTerrain } = require('./settlement-terrain.cjs')
const { prepareBanditCamps } = require('../prepare-bandit-camps.cjs')
const { distributeSettlementUnits } = require('./distribute-settlement-units.cjs')
const { validateSettlements } = require('./validate-settlements.cjs')
const { relocateSettlementAnimals, stockSettlementStables } = require('./settlement-animals.cjs')
const { assignContinentVillages } = loadGenerationTs('app/lib/campaign/continentVillagePlacement.ts')
const { SETTLEMENT_PROFILES } = loadGenerationTs('app/config/settlementProfiles.ts')
const { applyVillageStartingState } = loadGenerationTs('app/services/world/VillageStartingState.ts')
const { factionIdForCivilization } = loadGenerationTs('app/lib/campaign/playerRoster.ts')
const { populateVillageBase } = loadGenerationTs('app/services/world/VillageBaseState.ts')
const { OfflineWorldSpatial } = loadGenerationTs('app/services/world/offline/OfflineWorldSpatial.ts')
const buildings = require('../../../public/assets/data/gameplay/buildings.json')
const units = require('../../../public/assets/data/gameplay/units.json')
const equipment = require('../../../public/assets/data/gameplay/equipment.json')
const { Assets } = require('pixi.js')
// Shared unit configuration reads equipment stats from the data cache, without a renderer.
Assets.cache.set('config', { buildings, units, equipment })
const { createPlayerData } = loadGenerationTs('app/config/playerConfig.ts')
const configs = new Map()
const configFor = civ => {
  if (!configs.has(civ)) configs.set(civ, createPlayerData({ buildings, units, equipment }, civ ?? 'Hellas'))
  return configs.get(civ)
}

function prepareSettlements(source) {
  const blueprint = assignContinentVillages(source)
  const terrain = settlementTerrain(blueprint)
  const state = {
    version: 2,
    players: [],
    resources: structuredClone(blueprint.resources ?? []),
    // Wildlife is placed only after the complete AI layout and inhabitants.
    animals: [],
    runtime: { dayNightElapsedMs: 0 },
  }
  const banditConfig = configFor('Hellas')
  const banditCamps = prepareBanditCamps(blueprint, terrain, state, banditConfig.buildings, banditConfig.units)
  const rules = {
    buildingConfig: (i, type) => configFor(state.players[i]?.civ).buildings[type] ?? {},
    unitConfig: (i, type) => configFor(state.players[i]?.civ).units[type] ?? {},
  }
  const spatial = new OfflineWorldSpatial(terrain, state, building => building.size ?? 1, {
    protectVillageAccess: false,
    exactBuildingFootprints: true,
    traceConnectivity: false,
  })
  const sites = []
  for (const site of blueprint.settlements ?? []) {
    if (site.kind === 'banditCamp') continue
    if (!site.civ) throw new Error(`${site.id}: settlement has no civilization`)
    const label = `prepared:${blueprint.id}:${site.id}`
    const player = {
      label,
      factionId: factionIdForCivilization(site.civ),
      civ: site.civ,
      type: 'AI',
      units: [],
      buildings: [],
      ...(site.settlementType
        ? { settlementType: site.settlementType }
        : site.kind === 'city'
          ? { settlementType: 'city' }
          : {}),
    }
    state.players.push(player)
    populateVillageBase(player, state.players.length - 1, site.local, spatial, rules, {})
    sites.push({ ...site, ownerLabel: label })
  }
  let roads
  const generated = applyVillageStartingState(state, {}, terrain, rules, {
    prepareLayout(core, layout) {
      const coreSites = sites.map(site => ({
        ...site,
        profile: core.players.find(player => player.label === site.ownerLabel).settlementType,
      }))
      const squares = new Map()
      for (const site of coreSites) {
        const owner = core.players.find(player => player.label === site.ownerLabel)
        const anchor = owner.buildings[0]
        squares.set(site.id, layout.prepareCore(anchor))
      }
      roads = prepareSettlementRoads({ ...core, settlements: coreSites }, terrain, squares)
      layout.reserveRoads(roads)
      for (const site of coreSites) {
        const owner = core.players.find(player => player.label === site.ownerLabel)
        const tower = configFor(owner.civ).buildings.WatchTower
        layout.reserveDefenseSites(
          owner.buildings[0],
          SETTLEMENT_PROFILES[owner.settlementType].buildings.WatchTower ?? 0,
          tower.size,
          tower.range,
          owner.civ
        )
      }
    },
  })
  stockSettlementStables(generated, blueprint.seed)
  distributeSettlementUnits(generated, terrain, roads)
  generated.animals = structuredClone(blueprint.animals ?? [])
  relocateSettlementAnimals(generated, terrain, blueprint)
  // A prepared spawn is an idle position, not a saved live movement or economic task.
  for (const player of generated.players)
    for (const unit of player.units ?? []) {
      delete unit.autonomousJob
      unit.inactif = true
    }
  const result = {
    format: 'prepared-settlements',
    version: 1,
    mapId: blueprint.id,
    size: blueprint.size,
    settlements: sites.map(site => ({
      ...site,
      profile: generated.players.find(player => player.label === site.ownerLabel).settlementType,
      resourceLabels: generated.resources
        .filter(resource => resource.label?.startsWith(`start:${site.ownerLabel}:wheat:`))
        .map(resource => resource.label),
    })),
    banditCamps,
    heroSpawns: [],
    players: generated.players,
    resources: generated.resources,
    animals: generated.animals,
  }
  result.summary = validateSettlements(result, terrain, result.heroSpawns)
  validateSettlementRoads(roads, result, terrain)
  result.roads = roads
  result.summary.roads = result.roads.summary
  return result
}
module.exports = { prepareSettlements }
