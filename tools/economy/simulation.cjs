const { loadGenerationTs: load } = require('../maps/load-generation-ts.cjs')
const { simulateOfflineWorld } = load('app/services/world/offline/OfflineWorldSimulation.ts')
const { getWorkCycleMs } = load('app/lib/economy/workTiming.ts')
const { DAY_NIGHT_CONFIG } = load('app/config/gameplay.ts')
const { getVillagerWorkingMinutes } = load('app/lib/units/village/villagerSchedule.ts')
const { getEquipmentDurability } = load('app/lib/equipment/equipmentCondition.ts')
const { FORGE_FAMILIES } = load('app/lib/equipment/forgeUpgrades.ts')
// Actual offscreen engine, on an isolated synthetic scenario. Never mutates a map or a save.
function simulateHarvest(
  units,
  buildings,
  resourceDefinitions,
  tier,
  distance,
  startHour = DAY_NIGHT_CONFIG.startHour
) {
  const startMs = (((startHour - DAY_NIGHT_CONFIG.startHour + 24) % 24) * DAY_NIGHT_CONFIG.dayLengthMs) / 24
  const minuteMs = DAY_NIGHT_CONFIG.dayLengthMs / (24 * 60)
  let scheduledRestMs = 0
  const unit = {
    type: 'Villager',
    label: 'audit-worker',
    i: 10,
    j: 10,
    hitPoints: units.Villager.totalHitPoints,
    autonomousJob: 'wood',
    inventory: {
      resources: { wheat: 12 },
      equipment: [],
      toolsInitialized: true,
      activeWeapons: { tool: `axe_${['ceramic', 'bronze', 'bronze', 'iron'][tier]}` },
    },
  }
  const player = {
    type: 'Human',
    label: 'audit-simulation',
    population: 1,
    populationMax: 1,
    forgeUpgrades: Object.fromEntries(FORGE_FAMILIES.map(f => [f, tier])),
    units: [unit],
    buildings: [
      {
        type: 'TownCenter',
        label: 'audit-center',
        i: 5,
        j: 5,
        isBuilt: true,
        inventory: { resources: { wheat: 100 } },
      },
      { type: 'StoragePit', label: 'audit-depot', i: 10, j: 6, isBuilt: true, inventory: { resources: {} } },
      { type: 'Granary', label: 'audit-granary', i: 5, j: 12, isBuilt: true, inventory: { resources: { wheat: 100 } } },
    ],
  }
  const state = {
    camera: { x: 0, y: 0 },
    world: { mapType: 'world-region', size: 40 },
    runtime: { dayNightElapsedMs: 0 },
    players: [player],
    animals: [],
    resources: [
      {
        type: 'Tree',
        label: 'audit-tree',
        i: 10,
        j: 10 + distance,
        quantity: resourceDefinitions.Tree.totalQuantity,
        totalQuantity: resourceDefinitions.Tree.totalQuantity,
        hitPoints: resourceDefinitions.Tree.totalHitPoints,
      },
    ],
  }
  const terrain = Array.from({ length: 41 }, () => Array.from({ length: 41 }, () => ({ category: 'Grass' })))
  let gathered = 0,
    foodConsumed = 0,
    foodShortage = 0,
    elapsed = 0
  const stepMs = 30000,
    limit = DAY_NIGHT_CONFIG.dayLengthMs
  while (gathered < 100 && elapsed < limit) {
    const next = Math.min(elapsed + stepMs, limit)
    const result = simulateOfflineWorld(state, {
      fromElapsedMs: startMs + elapsed,
      toElapsedMs: startMs + next,
      terrain,
      spatialOptions: { traceConnectivity: false, protectVillageAccess: false },
      unitConfig: (_i, type) => units[type] ?? {},
      buildingConfig: (_i, type) => buildings[type] ?? {},
      cycleMs: (_i, work, action) => getWorkCycleMs(units.Villager, work, undefined, action),
      wheatMatureFrame: 5,
    })
    const startMinute = DAY_NIGHT_CONFIG.startHour * 60 + (startMs + elapsed) / minuteMs
    const endMinute = DAY_NIGHT_CONFIG.startHour * 60 + (startMs + next) / minuteMs
    scheduledRestMs += next - elapsed - getVillagerWorkingMinutes(unit, startMinute, endMinute) * minuteMs
    gathered += result.gathered.wood ?? 0
    foodConsumed += result.foodConsumed
    foodShortage += result.foodShortage
    elapsed = next
  }
  return {
    tier,
    distance,
    startHour,
    scheduledRestMs,
    elapsedMs: elapsed,
    reached: gathered >= 100,
    lowerBoundMs: Math.max(0, elapsed - stepMs),
    stepMs,
    gathered,
    foodConsumed,
    foodShortage,
    remainingWood: state.resources.filter(r => r.type === 'Tree').reduce((n, r) => n + (r.quantity ?? 0), 0),
    cycleMs: getWorkCycleMs(units.Villager, 'woodcutter'),
    finalBag: unit.inventory.resources,
    tool: unit.inventory.activeWeapons.tool,
    toolDurability: getEquipmentDurability(unit.inventory.activeWeapons.tool),
  }
}
function simulationCatalogue(units, buildings, resources) {
  return {
    kind: 'real-offline-engine-controlled-scenario',
    rows: [0, 2, 3]
      .flatMap(tier => [2, 18].map(distance => simulateHarvest(units, buildings, resources, tier, distance)))
      .concat([12, 18].map(hour => simulateHarvest(units, buildings, resources, 0, 2, hour))),
    dayLengthMs: DAY_NIGHT_CONFIG.dayLengthMs,
  }
}
function simulationSection(report, { table, row, format }) {
  if (!report.simulation) return ''
  return `<section id="simulation"><h2>Mesures du moteur de simulation</h2><p>Le vrai moteur hors écran du jeu est exécuté sur une scène de contrôle : un villageois niveau 1, un arbre initialement debout, un dépôt et des provisions. Objectif : récolter 100 bois, sac compris. Chaque ligne repart du même état ; seuls le matériau de la hache équipée, l’écart initial travailleur–arbre et l’heure de départ changent. Aucune sauvegarde n’est modifiée.</p>
${table(
  [
    'Hache équipée',
    'Écart initial (cases)',
    'Heure de départ',
    'Repos prévu dans la période (s)',
    '100 bois atteints entre (s de jeu)',
    'Bois récolté',
    'Nourriture consommée',
    'Nourriture manquante',
    'Bois restant',
    'Durabilité finale / 100',
  ],
  report.simulation.rows.map(r =>
    row([
      ['Pierre', 'Cuivre', 'Bronze', 'Fer'][r.tier],
      format(r.distance),
      format(r.startHour) + ' h',
      format(r.scheduledRestMs / 1000),
      r.reached
        ? `${format(r.lowerBoundMs / 1000)} et ${format(r.elapsedMs / 1000)}`
        : `Non atteint en ${format(r.elapsedMs / 1000)} s`,
      format(r.gathered),
      format(r.foodConsumed),
      format(r.foodShortage),
      format(r.remainingWood),
      format(r.toolDurability),
    ])
  )
)}
<p class="muted">Une hache réelle commence à 100 de durabilité et s’use à chaque coup. Cette scène ne possède pas de forge : une casse peut empêcher d’atteindre 100 bois. Le remplacement payé est vérifié séparément dans la section PNJ. Le repos affiché suit les horaires du villageois (repas et nuit), pas une annotation manuelle. Résolution de mesure : 30 secondes d’horloge de jeu. Le moteur applique son abattage, ses récoltes, transports, repas et horaires de travail. Terrain plat sans obstacle ni ennemi ; provisions initiales : 12 blés dans le sac et 200 dans les bâtiments. Cadence : fonction de calcul hors écran avec la configuration actuelle, sans sprites chargés (repli prévu par le moteur). Ce test ne reproduit pas les animations ni la fatigue dynamique du jeu en direct, ni une expédition en grotte. Il ne mesure pas les crafts manuels. Le temps de calcul sur l’ordinateur n’est pas le temps du joueur.</p></section>`
}
module.exports = { simulateHarvest, simulationCatalogue, simulationSection }
