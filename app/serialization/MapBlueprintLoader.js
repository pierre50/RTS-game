const TERRAIN_TYPES = ['Grass', 'Desert', 'Water', 'Jungle', 'DarkForest']

function decodeBase64Bytes(value, ArrayType = Uint8Array) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new ArrayType(bytes.buffer)
}

function toGrid(values, size, mapper) {
  const grid = []
  const width = size + 1
  for (let i = 0; i <= size; i++) {
    const row = []
    grid[i] = row
    for (let j = 0; j <= size; j++) {
      row[j] = mapper(values[i * width + j], i, j)
    }
  }
  return grid
}

function compatibleMaps(manifest, { size, mapType, positionsCount }) {
  return (manifest?.maps || []).filter(map => {
    return map.size === size && map.mapType === mapType && (!positionsCount || map.spawns >= positionsCount)
  })
}

export async function loadPregeneratedMapBlueprint({ size, mapType, positionsCount, random = Math.random } = {}) {
  const timings = {}
  let manifest
  try {
    const manifestStartedAt = performance.now()
    const response = await fetch('maps/manifest.json', { cache: 'no-store' })
    if (!response.ok) return null
    timings.blueprintManifestFetch = performance.now() - manifestStartedAt
    const manifestParseStartedAt = performance.now()
    manifest = await response.json()
    timings.blueprintManifestParse = performance.now() - manifestParseStartedAt
  } catch {
    return null
  }

  const candidates = compatibleMaps(manifest, { size, mapType, positionsCount })
  if (!candidates.length) return null

  const selected = candidates[Math.floor(random() * candidates.length)]
  try {
    const mapFetchStartedAt = performance.now()
    const response = await fetch(`maps/${selected.path}`, { cache: 'no-store' })
    if (!response.ok) return null
    timings.blueprintMapFetch = performance.now() - mapFetchStartedAt
    const mapParseStartedAt = performance.now()
    const payload = await response.json()
    timings.blueprintMapParse = performance.now() - mapParseStartedAt
    if (payload.format !== 'rts-map-blueprint' || payload.version !== 1 || payload.size !== size) return null

    const decodeStartedAt = performance.now()
    const terrainValues = decodeBase64Bytes(payload.terrain, Uint8Array)
    const reliefValues = decodeBase64Bytes(payload.relief, Int8Array)
    timings.blueprintDecode = performance.now() - decodeStartedAt
    const expectedCells = (size + 1) ** 2
    if (terrainValues.length !== expectedCells || reliefValues.length !== expectedCells) return null

    const gridStartedAt = performance.now()
    const terrain = toGrid(terrainValues, size, value => TERRAIN_TYPES[value] || 'Grass')
    const relief = toGrid(reliefValues, size, value => value)
    timings.blueprintGridInflate = performance.now() - gridStartedAt

    return {
      id: payload.id || selected.id,
      size,
      mapType: payload.mapType,
      seed: payload.seed,
      terrain,
      relief,
      spawns: (payload.spawns || []).slice(0, positionsCount || payload.spawns?.length || 0),
      resources: Array.isArray(payload.resources) ? payload.resources : null,
      timings,
    }
  } catch (error) {
    console.warn('Unable to load pregenerated map blueprint', error)
    return null
  }
}
