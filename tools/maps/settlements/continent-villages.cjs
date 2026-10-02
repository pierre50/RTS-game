const profiles = require('../../../app/config/civilizationPlacement.json')

// Reserve safe, anonymous sites before caves, camps and resources are generated.
function planContinentVillageSlots({
  terrain,
  biomeCodes,
  size,
  seed,
  sourcePosition = point => point,
  composition = false,
}) {
  const stride = size + 1
  const names = { T: 'temperate', F: 'blackforest', D: 'desert', S: 'steppe', J: 'jungle' }
  const pools = new Map()
  let randomState = seed >>> 0
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0
    return randomState / 4294967296
  }
  const land = (i, j) => terrain[i * stride + j] !== 2 && terrain[i * stride + j] !== 255
  const seen = new Map()
  for (let i = 32; i <= size - 32; i += 16) {
    for (let j = 32; j <= size - 32; j += 16) {
      const biome = names[String.fromCharCode(biomeCodes[i * stride + j])]
      if (!biome || !land(i, j)) continue
      let safe = true
      for (const di of [-20, 0, 20]) for (const dj of [-20, 0, 20]) if (!land(i + di, j + dj)) safe = false
      if (!safe) continue
      for (let di = -20; di <= 20 && safe; di++)
        for (let dj = -20; dj <= 20; dj++)
          if (!land(i + di, j + dj)) {
            safe = false
            break
          }
      if (!safe) continue
      const pool = pools.get(biome) ?? []
      pools.set(biome, pool)
      const count = (seen.get(biome) ?? 0) + 1
      seen.set(biome, count)
      const position = pool.length < 512 ? pool.length : Math.floor(random() * count)
      if (position < 512) pool[position] = { i, j }
    }
  }
  const sites = []
  // The quotas follow the same preferences as runtime dispatch; no civilization owns a site yet.
  for (const profile of Object.values(profiles)) {
    const biomes = [...pools.keys()].sort((a, b) => (profile.biomes[b] ?? 0) - (profile.biomes[a] ?? 0))
    let chosen
    for (const biome of biomes) {
      let best = -Infinity
      for (const local of pools.get(biome)) {
        const distance = sites.length
          ? Math.min(...sites.map(site => Math.hypot(site.local.i - local.i, site.local.j - local.j)))
          : size
        if (distance < 100) continue
        const score = distance + random() * 32
        if (score > best) {
          best = score
          chosen = { local, biome }
        }
      }
      if (chosen) break
    }
    if (!chosen) throw new Error('Not enough safe biome sites for all civilizations')
    sites.push({
      id: `village-slot-${sites.length}`,
      kind: 'village',
      radius: 18,
      importance: 1,
      biome: chosen.biome,
      region: { x: 0, y: 0 },
      local: chosen.local,
      world: sourcePosition(chosen.local),
    })
  }
  if (!composition) return sites
  const { loadGenerationTs } = require('../load-generation-ts.cjs')
  const { assignContinentVillages } = loadGenerationTs('app/lib/campaign/continentVillagePlacement.ts')
  const capitals = assignContinentVillages({ size, settlements: sites }).settlements
  const result = capitals.map(site => ({ ...site, id: `${site.civ}:city`, kind: 'city', settlementType: 'city' }))
  for (const [index, settlementType] of ['village', 'village', 'outpost', 'outpost', 'outpost'].entries()) {
    for (const capital of capitals) {
      let chosen,
        best = -Infinity
      for (const [biome, pool] of pools)
        for (const local of pool) {
          const distance = Math.min(...result.map(site => Math.hypot(site.local.i - local.i, site.local.j - local.j)))
          if (distance < 72) continue
          const homeDistance = Math.hypot(capital.local.i - local.i, capital.local.j - local.j)
          const score = (profiles[capital.civ].biomes[biome] ?? 0) * 30 - homeDistance + random() * 8
          if (score > best) {
            best = score
            chosen = { local, biome }
          }
        }
      if (!chosen) throw new Error(`Not enough safe sites for ${capital.civ} ${settlementType}`)
      result.push({
        ...capital,
        ...chosen,
        id: `${capital.civ}:${settlementType}-${index + 1}`,
        kind: 'village',
        settlementType,
        world: sourcePosition(chosen.local),
      })
    }
  }
  return result
}
module.exports = { planContinentVillageSlots }
