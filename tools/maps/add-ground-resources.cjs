const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { addGroundResources } = require('./ground-resources.cjs')
const { loadGenerationTs } = require('./load-generation-ts.cjs')
const { GROUND_RESOURCE_PLACEMENT: RULES } = loadGenerationTs('app/config/groundResources.ts')
const { footprint } = require('./settlements/validate-settlements.cjs')
const { settlementTerrain } = require('./settlements/settlement-terrain.cjs')
const hash = data => createHash('sha256').update(data).digest('hex')
const isGround = resource => ['GroundWood', 'GroundStone'].includes(resource.type)

// Populate published maps without rebuilding their settlements or changing existing resources.
function planGroundResources(blueprint, prepared) {
  const width = blueprint.size + 1
  const blocked = [
    ...blueprint.resources.filter(resource => !isGround(resource)),
    ...prepared.resources.filter(resource => !isGround(resource)),
    ...(blueprint.animals ?? []),
    ...(prepared.animals ?? []),
    ...(prepared.heroSpawns ?? []),
    ...prepared.players.flatMap(player => [...(player.units ?? []), ...(player.buildings ?? []).flatMap(footprint)]),
    ...(prepared.roads?.cells ?? []).map(([index]) => ({ i: Math.floor(index / width), j: index % width })),
  ]
  const occupied = new Set(blocked.map(point => `${point.i}:${point.j}`))
  const terrain = settlementTerrain(blueprint)
  const scattered = addGroundResources(
    {
      ...blueprint,
      resources: prepared.resources.filter(resource => !resource.isDestroyed && !isGround(resource)),
      animals: blocked,
    },
    {
      buildings: prepared.players.flatMap(player =>
        (player.buildings ?? []).filter(building => !building.isDestroyed).flatMap(footprint)
      ),
      isAvailable: (i, j) => {
        const cell = terrain[i]?.[j]
        return cell && cell.category !== 'Water' && !cell.border && !cell.inclined
      },
    }
  )
  const additions = scattered.resources.filter(resource => {
    if (!isGround(resource) || occupied.has(`${resource.i}:${resource.j}`)) return false
    const cell = terrain[resource.i]?.[resource.j]
    return cell && cell.category !== 'Water' && !cell.border && !cell.inclined
  })
  return additions
}

function main(worldDirectory, { refresh = false } = {}) {
  const manifestPath = path.join(worldDirectory, 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  for (const entry of manifest.maps) {
    const mapPath = path.join(worldDirectory, 'maps', entry.path)
    const preparedPath = path.join(worldDirectory, 'maps', entry.preparedSettlements.path)
    const raw = fs.readFileSync(mapPath)
    const preparedRaw = fs.readFileSync(preparedPath)
    const blueprint = JSON.parse(raw)
    const prepared = JSON.parse(preparedRaw)
    if (prepared.source.sha256 !== hash(raw) || entry.preparedSettlements.sha256 !== hash(preparedRaw))
      throw new Error('Prepared map does not match source or manifest')
    if (blueprint.generation?.publishedGroundResources?.version === RULES.version && !refresh) {
      console.log(`${blueprint.id}: already populated`)
      continue
    }
    const additions = planGroundResources(blueprint, prepared)
    const counts = Object.fromEntries(
      ['GroundWood', 'GroundStone'].map(type => [type, additions.filter(r => r.type === type).length])
    )
    if (!counts.GroundWood || !counts.GroundStone)
      throw new Error('No usable placements for both ground resource types')
    blueprint.resources = [...blueprint.resources.filter(resource => !isGround(resource)), ...additions]
    prepared.resources = [...prepared.resources.filter(resource => !isGround(resource)), ...additions]
    blueprint.generation = {
      ...blueprint.generation,
      groundResources: { ...RULES, counts },
      publishedGroundResources: { version: RULES.version, counts },
    }
    prepared.summary.resources = prepared.resources.length
    const encodedMap = JSON.stringify(blueprint) + '\n'
    prepared.source.sha256 = hash(encodedMap)
    const encodedPrepared = JSON.stringify(prepared) + '\n'
    entry.preparedSettlements.sha256 = hash(encodedPrepared)
    entry.preparedSettlements.sourceSha256 = prepared.source.sha256
    fs.writeFileSync(mapPath, encodedMap)
    fs.writeFileSync(preparedPath, encodedPrepared)
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
    console.log(JSON.stringify({ map: blueprint.id, ...counts }))
    for (const spawn of prepared.heroSpawns ?? []) {
      const nearest = Object.fromEntries(
        ['GroundWood', 'GroundStone'].map(type => {
          const resource = additions
            .filter(r => r.type === type)
            .sort((a, b) => Math.hypot(a.i - spawn.i, a.j - spawn.j) - Math.hypot(b.i - spawn.i, b.j - spawn.j))[0]
          return [
            type,
            {
              i: resource.i,
              j: resource.j,
              distance: Math.round(Math.hypot(resource.i - spawn.i, resource.j - spawn.j)),
            },
          ]
        })
      )
      console.log(JSON.stringify({ spawn: spawn.civ, nearest }))
    }
  }
}
if (require.main === module) main(path.resolve(process.argv[2]), { refresh: process.argv.includes('--refresh') })
module.exports = { planGroundResources }
