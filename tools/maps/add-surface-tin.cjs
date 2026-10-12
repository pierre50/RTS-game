const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { settlementTerrain } = require('./settlements/settlement-terrain.cjs')
const { footprint, validateSettlements } = require('./settlements/validate-settlements.cjs')
const { connectingCells, isClearing } = require('../caves/sites.cjs')
const { loadGenerationTs } = require('./load-generation-ts.cjs')
const { NEUTRAL_RESOURCE_QUANTITY_RANGES } = loadGenerationTs('app/classes/map/resources/ResourceQuantityRanges.ts')
const hash = data => createHash('sha256').update(data).digest('hex')

// Migration for published maps predating surface tin. New maps already use MapResources.
function planSurfaceTin(blueprint, prepared, terrain) {
  if ([...blueprint.resources, ...prepared.resources].some(r => r.type === 'Tin')) return []
  const stride = blueprint.size + 1
  const key = p => p.i * stride + p.j
  const occupied = new Set(
    [
      ...blueprint.resources,
      ...prepared.resources,
      ...(blueprint.animals ?? []),
      ...(prepared.animals ?? []),
      ...(prepared.heroSpawns ?? []),
      ...(blueprint.spawns ?? []),
      ...prepared.players.flatMap(p => [...(p.units ?? []), ...(p.buildings ?? []).flatMap(footprint)]),
    ].map(key)
  )
  const roads = new Set((prepared.roads?.cells ?? []).map(([index]) => index))
  const caves = blueprint.caves ?? []
  const camps = blueprint.banditCampPositions ?? []
  const paths = new Set(
    caves.flatMap(cave => camps.filter(c => c.caveId === cave.id).flatMap(camp => connectingCells(cave, camp))).map(key)
  )
  const copper = prepared.resources
    .filter(r => r.type === 'Copper' && !r.isDestroyed)
    .sort((a, b) => a.i - b.i || a.j - b.j)
  const additions = []
  const [minimum, maximum] = NEUTRAL_RESOURCE_QUANTITY_RANGES.Tin
  const safe = (i, j) => {
    const center = terrain[i]?.[j]
    if (!center || caves.some(c => isClearing({ i, j }, c))) return false
    if (camps.some(c => Math.hypot(i - c.i, j - c.j) < 12)) return false
    // Leave a flat, empty walking ring around every new blocking resource.
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        const cell = terrain[i + di]?.[j + dj]
        const index = (i + di) * stride + j + dj
        if (
          !cell ||
          cell.category === 'Water' ||
          cell.border ||
          cell.inclined ||
          cell.z !== center.z ||
          occupied.has(index) ||
          roads.has(index) ||
          paths.has(index)
        )
          return false
      }
    return true
  }
  for (let index = 0; index < copper.length; index += 3) {
    const anchor = copper[index]
    let chosen
    for (let radius = 3; radius <= 12 && !chosen; radius++) {
      for (let di = -radius; di <= radius && !chosen; di++) {
        for (let dj = -radius; dj <= radius; dj++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== radius) continue
          const i = anchor.i + di,
            j = anchor.j + dj
          if (safe(i, j)) {
            chosen = { i, j }
            break
          }
        }
      }
    }
    if (!chosen) continue
    const quantity = minimum + (((key(chosen) + (blueprint.seed ?? 0)) >>> 0) % (maximum - minimum + 1))
    additions.push({ type: 'Tin', ...chosen, quantity })
    occupied.add(key(chosen))
  }
  return additions
}

function main(worldDirectory) {
  const manifestPath = path.join(worldDirectory, 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  for (const entry of manifest.maps) {
    const mapPath = path.join(worldDirectory, 'maps', entry.path)
    const preparedPath = path.join(worldDirectory, 'maps', entry.preparedSettlements.path)
    const raw = fs.readFileSync(mapPath)
    const blueprint = JSON.parse(raw)
    const prepared = JSON.parse(fs.readFileSync(preparedPath, 'utf8'))
    if (prepared.source.sha256 !== hash(raw)) throw new Error('Prepared map does not match source')
    const terrain = settlementTerrain(blueprint)
    const additions = planSurfaceTin(blueprint, prepared, terrain)
    if (!additions.length) {
      console.log(`${blueprint.id}: no changes`)
      continue
    }
    blueprint.resources.push(...additions)
    prepared.resources.push(...additions)
    prepared.summary = { ...prepared.summary, ...validateSettlements(prepared, terrain, prepared.heroSpawns) }
    const encodedMap = JSON.stringify(blueprint) + '\n'
    prepared.source.sha256 = hash(encodedMap)
    const encodedPrepared = JSON.stringify(prepared) + '\n'
    entry.preparedSettlements.sha256 = hash(encodedPrepared)
    entry.preparedSettlements.sourceSha256 = prepared.source.sha256
    fs.writeFileSync(mapPath, encodedMap)
    fs.writeFileSync(preparedPath, encodedPrepared)
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
    console.log(
      JSON.stringify({
        map: blueprint.id,
        deposits: additions.length,
        tin: additions.reduce((sum, r) => sum + r.quantity, 0),
      })
    )
  }
}

if (require.main === module) main(path.resolve(process.argv[2]))
module.exports = { planSurfaceTin }
