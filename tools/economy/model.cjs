const { loadGenerationTs } = require('../maps/load-generation-ts.cjs')
const { getBuildingTrainingCapacity, getTrainingStartingExperience } = loadGenerationTs(
  'app/lib/training/trainingRules.ts'
)
const { getBuildingCombatProfile } = loadGenerationTs('app/lib/buildings/towerCombat.ts')
const { getHouseProfile } = loadGenerationTs('app/lib/housing/houseLevels.ts')
const { getTownCenterProfile } = loadGenerationTs('app/lib/buildings/townCenter.ts')
const { getStorageCapacity } = loadGenerationTs('app/lib/resources/storagePolicy.ts')
const { getBuildingLevels, getBuildingConfigForLevel } = loadGenerationTs('app/lib/buildings/buildingLevel.ts')
const { getBuildingUpgradeCost } = loadGenerationTs('app/lib/buildings/buildingUpgrade.ts')
const { estimateConstructionDuration } = loadGenerationTs('app/lib/buildings/constructionDuration.ts')
const { RESOURCE_STOCKPILE_TYPES, CAMP_DECORATION_BUILDING_TYPES } = loadGenerationTs('app/constants/entities.ts')
const { TERRAIN_TYPES } = loadGenerationTs('app/constants/blueprintTerrain.ts')

function nonnegative(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`Valeur invalide : ${label}`)
  return value
}
function validateCost(cost, label) {
  for (const [resource, amount] of Object.entries(cost ?? {})) nonnegative(amount, `${label}.${resource}`)
}
const ratio = (cost, denominator) =>
  denominator > 0 ? Object.fromEntries(Object.entries(cost).map(([key, value]) => [key, value / denominator])) : null

function buildingInventory(definitions) {
  const buildings = [],
    upgrades = [],
    findings = []
  for (const [type, definition] of Object.entries(definitions)) {
    const levels = getBuildingLevels(definition)
    for (const [index, level] of levels.entries()) {
      const config = getBuildingConfigForLevel(definition, level)
      validateCost(config.cost, `${type} niveau ${level}`)
      const row = {
        type,
        level,
        decoration: CAMP_DECORATION_BUILDING_TYPES.includes(type),
        cost: config.cost ?? null,
        constructionWork: config.constructionWorkRequired ?? config.constructionTime ?? null,
        constructionDuration: estimateConstructionDuration(
          config.constructionWorkRequired ?? config.constructionTime,
          level
        ),
        arrivals: type === 'TownCenter' ? getTownCenterProfile({ buildingLevel: level }) : null,
        towerCombat: getBuildingCombatProfile({ type, buildingLevel: level }) ?? null,
        storageCapacity: ['StoragePit', 'Granary', 'TownCenter', 'Chest'].includes(type)
          ? getStorageCapacity({ type, buildingLevel: level })
          : null,
        trainingCapacity: config.units?.length ? getBuildingTrainingCapacity({ type, buildingLevel: level }) : null,
        trainingExperience: Object.fromEntries(
          (config.units ?? []).map(unit => [unit, getTrainingStartingExperience({ type, buildingLevel: level }, unit)])
        ),
        shelterCapacity: config.shelterCapacity ?? 0,
        beds: type === 'House' ? getHouseProfile({ buildingLevel: level }).beds : null,
        hitPoints: config.totalHitPoints ?? null,
        size: config.size ?? null,
        conditions: config.conditions ?? [],
        costPerShelterPlace: ratio(config.cost ?? {}, config.shelterCapacity),
      }
      buildings.push(row)
      if (index === 0) continue
      const fromLevel = levels[index - 1]
      const previous = getBuildingConfigForLevel(definition, fromLevel)
      const cost = getBuildingUpgradeCost(definition, fromLevel, level)
      const addedShelter = row.shelterCapacity - (previous.shelterCapacity ?? 0)
      const addedHitPoints = (config.totalHitPoints ?? 0) - (previous.totalHitPoints ?? 0)
      upgrades.push({
        type,
        fromLevel,
        toLevel: level,
        cost,
        constructionWork: config.constructionWorkRequired ?? config.constructionTime ?? 1,
        constructionDuration: estimateConstructionDuration(
          config.constructionWorkRequired ?? config.constructionTime ?? 1,
          level
        ),
        addedShelter,
        addedHitPoints,
        costPerAddedShelterPlace: ratio(cost, addedShelter),
      })
      if (row.shelterCapacity > 0 && addedShelter <= 0)
        findings.push({
          kind: 'observation',
          title: `${type} ${fromLevel} → ${level} : aucune place d’abri supplémentaire`,
          detail: `Gain de résistance : ${addedHitPoints} PV. Le coût ne finance donc pas une hausse de la capacité d’abri configurée.`,
        })
      if (!Object.values(cost).some(value => value > 0))
        findings.push({
          kind: 'observation',
          title: `${type} ${fromLevel} → ${level} : aucun matériau demandé`,
          detail: 'Vérifier si cette amélioration gratuite en matériaux est intentionnelle.',
        })
    }
  }
  return { buildings, upgrades, findings }
}

function mapInventory(map, resources, definitions, zoneSize = 64) {
  if (map.format !== 'map-blueprint' || map.version !== 2)
    throw new Error('Une carte finalisée map-blueprint version 2 est requise.')
  if (!Number.isInteger(map.size) || map.size < 1) throw new Error('Taille de carte invalide.')
  if (!Number.isInteger(zoneSize) || zoneSize < 1) throw new Error('Taille de zone invalide.')
  const stride = map.size + 1
  const packed = typeof map.terrain === 'string' ? Buffer.from(map.terrain, 'base64') : null
  if (packed && packed.length !== stride * stride) throw new Error('Dimensions du terrain invalides.')
  if (
    !packed &&
    (!Array.isArray(map.terrain) ||
      map.terrain.length !== stride ||
      map.terrain.some(row => !Array.isArray(row) || row.length !== stride))
  )
    throw new Error('Dimensions du terrain invalides.')
  const zones = new Map()
  const getZone = (i, j) => {
    const zi = Math.floor(i / zoneSize),
      zj = Math.floor(j / zoneSize),
      key = `${zi}:${zj}`
    if (!zones.has(key)) zones.set(key, { i: zi * zoneSize, j: zj * zoneSize, cells: 0, landCells: 0, quantities: {} })
    return zones.get(key)
  }
  const terrainAt = (i, j) => {
    const value = packed ? packed[i * stride + j] : map.terrain[i][j]
    if (value == null || value === 255) return null
    const type = typeof value === 'number' ? TERRAIN_TYPES[value] : value
    if (!TERRAIN_TYPES.includes(type)) throw new Error(`Terrain inconnu : ${value}`)
    return type
  }
  let cells = 0,
    landCells = 0
  for (let i = 0; i < stride; i++)
    for (let j = 0; j < stride; j++) {
      const type = terrainAt(i, j)
      if (type == null) continue
      cells++
      const zone = getZone(i, j)
      zone.cells++
      if (type !== 'Water' && type !== '') {
        landCells++
        zone.landCells++
      }
    }
  const totals = Object.fromEntries(
    Object.keys(definitions).map(type => [
      type,
      {
        type,
        resource: RESOURCE_STOCKPILE_TYPES[type] ?? type,
        nodes: 0,
        quantity: 0,
        capacity: 0,
        defaultsUsed: 0,
      },
    ])
  )
  if (!Array.isArray(resources)) throw new Error('Liste des ressources absente.')
  const warnings = new Map()
  const warn = reason => warnings.set(reason, (warnings.get(reason) ?? 0) + 1)
  const occupied = new Set()
  for (const node of resources) {
    if (!definitions[node.type]) throw new Error(`Ressource inconnue : ${node.type}`)
    const { i, j } = node
    if (
      !Number.isInteger(i) ||
      !Number.isInteger(j) ||
      i < 0 ||
      j < 0 ||
      i >= stride ||
      j >= stride ||
      terrainAt(i, j) == null
    ) {
      warn('Ressources hors des cases valides, exclues des totaux')
      continue
    }
    const quantity = nonnegative(node.quantity ?? node.totalQuantity ?? definitions[node.type].totalQuantity, node.type)
    const capacity = nonnegative(node.totalQuantity ?? node.quantity ?? definitions[node.type].totalQuantity, node.type)
    if (quantity > capacity) throw new Error(`Quantité supérieure à la capacité : ${node.type} (${i}, ${j})`)
    const key = `${i}:${j}`
    if (occupied.has(key)) warn('Plusieurs ressources déclarées sur une même case, conservées dans cet inventaire')
    occupied.add(key)
    if (['Water', ''].includes(terrainAt(i, j))) warn('Ressources déclarées sur eau, conservées dans cet inventaire')
    const row = totals[node.type]
    row.nodes++
    row.quantity += quantity
    row.capacity += capacity
    if (node.quantity == null && node.totalQuantity == null) row.defaultsUsed++
    const zone = getZone(i, j)
    zone.quantities[row.resource] = (zone.quantities[row.resource] ?? 0) + quantity
  }
  return {
    id: map.id,
    stride,
    cells,
    landCells,
    waterCells: cells - landCells,
    zoneSize,
    resources: Object.values(totals).map(row => ({
      ...row,
      per100LandCells: landCells ? (row.quantity * 100) / landCells : null,
      per100Cells: cells ? (row.quantity * 100) / cells : null,
    })),
    zones: [...zones.values()],
    warnings: [...warnings].map(([message, count]) => `${message} : ${count}.`),
  }
}
module.exports = { buildingInventory, mapInventory }
