#!/usr/bin/env node
const { groundResourceCatalogue } = require('./economy/ground-resources.cjs')
const { npcEquipmentCatalogue } = require('./economy/npc-equipment.cjs')
const { simulationCatalogue } = require('./economy/simulation.cjs')
const { supplyCatalogue, readSaveStocks } = require('./economy/supply.cjs')
const { objectiveCatalogue } = require('./economy/objectives.cjs')
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { buildingInventory, mapInventory } = require('./economy/model.cjs')
const { renderReport } = require('./economy/report.cjs')
const { craftCatalogue, technologyCatalogue } = require('./economy/catalogue.cjs')
const { toolLifetimeCatalogue } = require('./economy/tool-lifetime.cjs')
const { performanceCatalogue } = require('./economy/performance.cjs')
const { validateCapture } = require('./economy/capture.cjs')
const root = path.resolve(__dirname, '..')
const defaultMap = 'public/maps/worlds/world-test-1000/maps/world-test-1000-r0-0.map'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

function parseArgs(args) {
  const opts = { map: path.join(root, defaultMap), out: path.join(root, 'reports/economy'), zoneSize: 64 }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--help') opts.help = true
    else if (['--map', '--out', '--zone-size', '--capture', '--save'].includes(arg)) {
      const value = args[++i]
      if (!value || value.startsWith('--')) throw new Error(`Valeur manquante pour ${arg}`)
      if (arg === '--zone-size') opts.zoneSize = Number(value)
      else opts[arg.slice(2)] = path.resolve(value)
    } else throw new Error(`Argument inconnu : ${arg}`)
  }
  if (!Number.isInteger(opts.zoneSize) || opts.zoneSize < 1) throw new Error('--zone-size doit être un entier positif.')
  return opts
}
function buildAudit(opts) {
  const sources = []
  const read = file => {
    const bytes = fs.readFileSync(file)
    sources.push({ path: path.relative(root, file), sha256: hash(bytes) })
    return JSON.parse(bytes)
  }
  const buildings = read(path.join(root, 'public/assets/data/gameplay/buildings.json'))
  const resourceDefinitions = read(path.join(root, 'public/assets/data/gameplay/resources.json'))
  const units = read(path.join(root, 'public/assets/data/gameplay/units.json'))
  const performance = performanceCatalogue(read(path.join(root, 'public/assets/data/gameplay/equipment.json')), units)
  const map = read(opts.map)
  const mapHash = sources.at(-1).sha256
  const preparedPath = opts.map.replace(/\.map$/, '.settlements.json')
  let resources = map.resources,
    mode = 'Carte brute',
    prepared = null
  if (preparedPath !== opts.map && fs.existsSync(preparedPath)) {
    prepared = read(preparedPath)
    if (
      prepared.format !== 'prepared-settlements' ||
      prepared.version !== 1 ||
      prepared.mapId !== map.id ||
      prepared.size !== map.size ||
      prepared.source?.sha256 !== mapHash
    )
      throw new Error(
        'Préparation incompatible ou périmée par rapport à la carte. Régénérer les settlements avant cet audit.'
      )
    resources = prepared.resources
    mode = 'Carte préparée, toutes civilisations'
  }
  const supply = supplyCatalogue(
    map,
    prepared,
    read(path.join(root, 'public/maps/interiors/cave/catalog.json')),
    opts.save ? readSaveStocks(read(opts.save)) : null
  )
  const capture = opts.capture ? validateCapture(read(opts.capture)) : null
  const crafts = craftCatalogue(),
    technologies = technologyCatalogue()
  const inventory = buildingInventory(buildings)
  const mapReport = mapInventory(map, resources, resourceDefinitions, opts.zoneSize)
  const notes = [
    'Inventaire des définitions de base et des ressources déclarées sur une carte finalisée. Les valeurs sont relues à chaque exécution.',
    'Les niveaux et coûts des rénovations utilisent les fonctions du jeu. Les niveaux internes commencent à 0. Les recettes restent séparées par matériau : aucun taux de conversion fictif.',
    'Le travail de construction est exprimé en unités de travail de base (constructionTime), pas en secondes. Trajets, énergie, repas et nombre de travailleurs ne sont pas simulés.',
    'La capacité d’abri configurée est distincte du nombre de lits et de la population réellement accueillie. Les ratios par place concernent uniquement cette capacité.',
    'Les densités divisent le stock par les cases valides ou les cases terrestres, hors remplissage 255. Une case terrestre n’est pas nécessairement accessible. Les zones sont des carrés de coordonnées de la grille.',
    'Quantités initiales déclarées, sans repousses, maturité des cultures, chasse, butin, coffres, stocks des villages, commerce, formations ni ressources des grottes. Aucun rendement par minute ni verdict automatique sur le plaisir de jeu.',
    prepared
      ? 'Les ressources préparées remplacent intégralement celles de la carte brute. Toutes les civilisations sont incluses ; une partie réelle retire notamment les champs initiaux de la civilisation humaine. La préparation est liée à cette carte par son empreinte ; la fraîcheur de ses règles de génération n’est pas certifiée par cet audit.'
      : 'Aucune préparation voisine trouvée : les quantités proviennent de la carte brute, avant placement des villages.',
    'Les ressources déclarées ne passent pas par le chargement graphique : collisions, textures et autres exclusions au chargement peuvent réduire le stock effectif.',
  ]
  const ruleFiles = [
    'app/config/housing.ts',
    'app/lib/housing/houseLevels.ts',
    'app/config/townCenter.ts',
    'app/config/forge.ts',
    'app/config/buildingLevels.ts',
    'app/serialization/TwoLevelBuildingMigration.ts',
    'app/lib/equipment/forgeProduction.ts',
    'app/lib/buildings/townCenter.ts',
    'app/lib/population/villagerArrivals.ts',
    'app/config/towerCombat.ts',
    'app/lib/buildings/towerCombat.ts',
    'app/classes/building/BuildingCombat.ts',
    'app/config/militaryTraining.ts',
    'app/lib/training/trainingRules.ts',
    'app/config/market.ts',
    'app/config/storage.ts',
    'app/config/equipmentDurability.ts',
    'app/lib/resources/storagePolicy.ts',
    'app/lib/economy/collectiveStock.ts',
    'tools/economy/ground-resources.cjs',
    'app/lib/graphics/resourceMirroring.ts',
    'tools/maps/ground-resources.cjs',
    'app/config/groundResources.ts',
    'app/config/gameplay.ts',
    'app/lib/resources/groundResourceRegrowth.ts',
    'app/lib/hero/heroGroundCollection.ts',
    'app/lib/units/supplies/groundToolRecovery.ts',
    'app/lib/units/supplies/toolPreparation.ts',
    'app/lib/units/village/villageGroundRecovery.ts',
    'app/services/world/offline/OfflineGroundRecovery.ts',
    'app/services/world/offline/OfflineWorldResources.ts',
    'app/services/world/offline/OfflineResourceSearch.ts',
    'app/services/world/work/OfflineWorkResources.ts',
    'app/classes/resources/ResourceRespawn.ts',
    'app/classes/map/resources/MapNaturalResources.ts',
    'app/services/NaturalRegrowthSystem.ts',
    'app/lib/units/autonomy/villagerAutonomy.ts',
    'app/classes/unit/UnitResourceGathering.ts',

    'app/lib/buildings/buildingLevel.ts',
    'app/lib/buildings/constructionDuration.ts',
    'app/lib/buildings/buildingUpgrade.ts',
    'app/lib/hero/heroCraftRecipes.ts',
    'app/lib/hero/heroForgeRecipes.ts',
    'app/lib/equipment/arrowRecipes.ts',
    'app/lib/equipment/workTools.ts',
    'app/lib/economy/startingProvisions.ts',
    'app/serialization/PreparedSettlementState.ts',
    'app/services/world/offline/OfflineToolReturn.ts',
    'app/lib/economy/collectiveUnitTasks.ts',
    'app/services/CollectiveVillageWork.ts',
    'app/services/CollectiveVillageEvents.ts',
    'app/lib/equipment/equipmentWear.ts',
    'app/lib/equipment/equipmentSlots.ts',
    'app/lib/units/combat/npcWeapons.ts',
    'app/lib/units/combat/unitArrows.ts',
    'app/lib/units/supplies/townToolSupply.ts',
    'app/lib/units/supplies/townArrowSupply.ts',
    'app/config/playerConfig.ts',
    'app/services/world/NpcArrowSupplySystem.ts',
    'tools/economy/npc-equipment.cjs',
    'tools/economy/performance.cjs',
    'tools/economy/tool-lifetime.cjs',
    'app/lib/equipment/equipmentCondition.ts',
    'app/lib/equipment/equipmentRepair.ts',
    'app/lib/hero/heroCombatRules.ts',
    'app/lib/hero/heroPowerCharge.ts',
    'app/lib/hero/heroDefense.ts',
    'app/lib/hero/heroMeleeTools.ts',
    'app/lib/animations/actionFrameSequences.ts',
    'app/lib/units/energyRules.ts',
    'tools/economy/simulation.cjs',
    'tools/economy/catalogue.cjs',
    'tools/economy/objectives.cjs',
    'tools/economy/sections.cjs',
    'app/lib/equipment/forgeUpgrades.ts',
    'app/lib/equipment/equipmentMaterials.ts',
    'app/config/equipmentLegacyReplacements.json',
    'app/lib/resources/miningEquipment.ts',
    'app/lib/units/unitExperience.ts',
    'app/lib/equipment/equipmentStats.ts',
    'app/lib/equipment/equipmentMarket.ts',
    'app/lib/equipment/marketSettlementGold.ts',
    'engine/services/BuildingInteriorSpaceMinerals.ts',
    'app/lib/combat/combat.ts',
    'app/lib/combat/combatHit.ts',
    'app/lib/combat/parry.ts',
    'app/lib/economy/workRules.ts',
    'app/lib/economy/workTiming.ts',
    'app/services/world/offline/OfflineWorldSimulation.ts',
    'app/services/world/work/OfflineWorkImpacts.ts',
    'app/classes/unit/work/UnitWoodcuttingAction.ts',
    'app/constants/entities.ts',
    'app/constants/blueprintTerrain.ts',
  ]
  for (const file of ruleFiles) sources.push({ path: file, sha256: hash(fs.readFileSync(path.join(root, file))) })
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode,
    sources,
    notes,
    ...inventory,
    crafts,
    technologies,
    performance,
    toolLifetime: toolLifetimeCatalogue(units, resourceDefinitions, buildings, crafts, performance),
    npcEquipment: npcEquipmentCatalogue(),
    groundResources: groundResourceCatalogue(mapReport, resourceDefinitions, map),
    supply,
    simulation: simulationCatalogue(units, buildings, resourceDefinitions),
    objectives: objectiveCatalogue(inventory.buildings, crafts, performance, mapReport, supply),
    capture,
    map: mapReport,
  }
}
function main(args = process.argv.slice(2)) {
  const opts = parseArgs(args)
  if (opts.help) {
    console.log(
      'Usage: pnpm economy:audit [--map fichier.map] [--out dossier] [--zone-size 64] [--capture economy-flow.json] [--save partie.json]'
    )
    return
  }
  const report = buildAudit(opts)
  fs.mkdirSync(opts.out, { recursive: true })
  fs.writeFileSync(path.join(opts.out, 'economy.json'), `${JSON.stringify(report, null, 2)}\n`)
  fs.writeFileSync(path.join(opts.out, 'index.html'), renderReport(report))
  console.log(
    `Audit : ${report.buildings.length} variantes, ${report.upgrades.length} améliorations, ${report.map.resources.reduce((n, r) => n + r.nodes, 0)} ressources placées.\nRapport : ${path.join(opts.out, 'index.html')}`
  )
}
if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(`Audit économique : ${error.message}`)
    process.exitCode = 1
  }
}
module.exports = { parseArgs, buildAudit, main }
