const { randomFrom } = require('../maps/noise.cjs')
const { VARIANTS } = require('./layout.cjs')
const { findCaveSite, isClearing, connectingCells } = require('./sites.cjs')

function planCaves(blueprint, terrainAppearance = []) {
  if (blueprint.caves) return blueprint.caves
  if (blueprint.kind === 'interior' || blueprint.mapType === 'interior') return []
  const random = randomFrom(`${blueprint.seed}:cave-placement-v3`)
  const site = findCaveSite(blueprint, terrainAppearance, random)
  blueprint.cavePlacementVersion = 3
  if (!site) return []
  const tier = ['small', 'medium', 'large'][Math.floor(random() * 3)]
  const variant = tier === 'small' ? 'circle' : VARIANTS[Math.floor(random() * VARIANTS.length)]
  const cave = {
    ...site.cave,
    id: `${blueprint.id ?? blueprint.seed}:cave-1`,
    blueprintId: `cave-${tier}-${variant}`,
    tier,
    seed: Math.floor(random() * 0x7fffffff),
  }
  blueprint.banditCampPositions = site.camps.map(camp => ({ ...camp, caveId: cave.id }))
  let campIndex = 0
  blueprint.settlements = (blueprint.settlements ?? []).map(settlement =>
    settlement.kind === 'banditCamp'
      ? { ...settlement, local: blueprint.banditCampPositions[campIndex++] ?? settlement.local }
      : settlement
  )
  const paths = new Set(site.camps.flatMap(camp => connectingCells(cave, camp)).map(cell => `${cell.i}:${cell.j}`))
  blueprint.resources = (blueprint.resources ?? []).filter(
    cell =>
      !isClearing(cell, cave) && !site.camps.some(camp => isClearing(cell, camp)) && !paths.has(`${cell.i}:${cell.j}`)
  )
  return [cave]
}
const isCaveClearing = isClearing
module.exports = { planCaves, isCaveClearing }
