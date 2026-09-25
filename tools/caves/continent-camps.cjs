const { planContinentCaves } = require('./continent-placement.cjs')
const { randomFrom } = require('../maps/noise.cjs')

const SMALL_CAMP_LAND_CELLS = 40000
const LAIR_FRACTION = 0.4

function planContinentCamps({
  terrain,
  size,
  seed,
  id,
  settlements,
  caves,
  cellsPerCamp = SMALL_CAMP_LAND_CELLS,
  lairFraction = LAIR_FRACTION,
}) {
  if (!Number.isFinite(lairFraction) || lairFraction < 0 || lairFraction > 1)
    throw new Error('Lair fraction must be between 0 and 1')
  const random = randomFrom(`${seed}:continent-camps-v1`)
  const camps = []
  const add = (position, profile, caveId) => {
    const count = profile === 'lair' ? 5 + Math.floor(random() * 4) : 2 + Math.floor(random() * 3)
    const unitTypes = Array.from({ length: count }, (_, index) =>
      profile === 'lair' && index === 0 ? 'BanditChief' : index % 3 === 2 ? 'BanditArcher' : 'BanditSword'
    )
    camps.push({
      i: position.i,
      j: position.j,
      id: `${id}:camp-${camps.length + 1}`,
      profile,
      seed: Math.floor(random() * 0x7fffffff),
      unitTypes,
      ...(caveId ? { caveId } : {}),
    })
  }
  const chosen = caves.map(cave => ({ cave, rank: random() })).sort((a, b) => a.rank - b.rank)
  for (const { cave } of chosen.slice(0, Math.round(caves.length * lairFraction))) {
    const position = { i: cave.i + 4, j: cave.j + 4 }
    if (settlements.some(site => Math.hypot(site.local.i - position.i, site.local.j - position.j) < 40)) continue
    if (camps.some(camp => Math.hypot(camp.i - position.i, camp.j - position.j) < 80)) continue
    add(position, 'lair', cave.id)
  }
  const smallPlan = planContinentCaves({
    terrain,
    size,
    seed: `${seed}:small-camps`,
    id,
    settlements: [
      ...settlements,
      ...caves.map(local => ({ local })),
      ...camps.map(local => ({ local, clearance: 80 })),
    ],
    cellsPerCave: cellsPerCamp,
  })
  for (const position of smallPlan.caves) {
    if (camps.some(camp => Math.hypot(camp.i - position.i, camp.j - position.j) < 80)) continue
    add(position, 'small')
  }
  return camps
}
module.exports = { planContinentCamps, SMALL_CAMP_LAND_CELLS, LAIR_FRACTION }
