import type { EnvironmentTerrainParams } from '../../constants'
import type { TerrainGrid } from './MapGenerationTypes'

export type GeneratedTerrainData = {
  seed: number
  terrain: TerrainGrid
}

export function generateTerrainMap(
  gridSize: number = 120,
  seed?: number,
  params: Partial<EnvironmentTerrainParams> = {}
): GeneratedTerrainData {
  let resolvedSeed = seed
  if (resolvedSeed == null) resolvedSeed = Math.random() * 9999

  function hash(x: number, y: number): number {
    const n = Math.sin(x * 127.1 + y * 311.7 + resolvedSeed! * 3.7) * 43758.5453
    return n - Math.floor(n)
  }

  function noise(x: number, y: number): number {
    const xi = Math.floor(x),
      yi = Math.floor(y)
    const xf = x - xi,
      yf = y - yi
    const smooth = (t: number) => t * t * (3 - 2 * t)
    const u = smooth(xf),
      v = smooth(yf)
    const a = hash(xi, yi),
      b = hash(xi + 1, yi)
    const c = hash(xi, yi + 1),
      d = hash(xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * v + (d + a - b - c) * u * v
  }

  function fbm(x: number, y: number, octaves: number = 5): number {
    let val = 0,
      amp = 0.5,
      freq = 1,
      sum = 0
    for (let o = 0; o < octaves; o++) {
      val += noise(x * freq, y * freq) * amp
      sum += amp
      amp *= 0.5
      freq *= 2
    }
    return val / sum
  }

  const scale = 4 / gridSize
  const half = gridSize / 2

  // Plateau + narrow falloff: the inner 85% radius (~72% of the map's area) is fully
  // land-biased and untouched by edge proximity, so the coastline forms from a thin band
  // near the border instead of eating into the interior. There are no boats to reach
  // stray islands, so the map should read as one big landmass, not a natural archipelago.
  const falloffPlateau = 0.85
  function radialFalloff(i: number, j: number): number {
    const dx = (i - half) / half
    const dy = (j - half) / half
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist <= falloffPlateau) return 1
    const t = Math.min(1, (dist - falloffPlateau) / (1 - falloffPlateau))
    return 1 - t * t * (3 - 2 * t)
  }

  // One map = one environment: `groundType` is the single ground type covering this
  // environment's non-water land (see EnvironmentTerrainParams) — water sparsity,
  // patchwork shapes and lakes come from `params` too. The default below (used only if
  // a caller omits `params` entirely) matches Temperate.
  const terrainValueByType = {
    Grass: 0,
    Desert: 1,
    Jungle: 3,
    DarkForest: 4,
    Dirt: 5,
    Snow: 7,
  } satisfies Record<'Grass' | 'Desert' | 'Jungle' | 'DarkForest' | 'Dirt' | 'Snow', TerrainGrid[number][number]>
  const groundTypeValue = terrainValueByType[params.groundType ?? 'Grass']
  const height = new Float32Array(gridSize * gridSize)
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      height[i * gridSize + j] = fbm(i * scale, j * scale)
    }
  }

  const waterThreshold = 0.28

  const terrainMap: TerrainGrid = []
  const borderWaterWidth = Math.max(4, Math.floor(gridSize * 0.04))
  for (let i = 0; i < gridSize; i++) {
    terrainMap[i] = []
    for (let j = 0; j < gridSize; j++) {
      let h = height[i * gridSize + j]
      const fo = radialFalloff(i, j)

      h += (fo - 0.5) * 0.75

      terrainMap[i][j] = h < waterThreshold ? 2 : groundTypeValue
    }
  }

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < gridSize - 1; i++) {
      for (let j = 1; j < gridSize - 1; j++) {
        const wn =
          (terrainMap[i - 1][j] === 2 ? 1 : 0) +
          (terrainMap[i + 1][j] === 2 ? 1 : 0) +
          (terrainMap[i][j - 1] === 2 ? 1 : 0) +
          (terrainMap[i][j + 1] === 2 ? 1 : 0)
        if (terrainMap[i][j] !== 2 && wn >= 3) terrainMap[i][j] = 2
        if (terrainMap[i][j] === 2 && wn <= 1) terrainMap[i][j] = groundTypeValue
      }
    }
  }

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      if (
        i < borderWaterWidth ||
        j < borderWaterWidth ||
        i >= gridSize - borderWaterWidth ||
        j >= gridSize - borderWaterWidth
      ) {
        terrainMap[i][j] = 2
      }
    }
  }

  // There are no boats: drown every land component except the largest one so the map
  // is a single reachable landmass instead of a mainland dotted with useless islets.
  function removeDisconnectedLand(): void {
    const visited = new Uint8Array(gridSize * gridSize)
    let bestComponent: number[] | null = null
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const start = i * gridSize + j
        if (terrainMap[i][j] === 2 || visited[start]) continue
        visited[start] = 1
        const component = [start]
        const stack = [start]
        while (stack.length) {
          const idx = stack.pop()!
          const ci = Math.floor(idx / gridSize)
          const cj = idx % gridSize
          // Plain index access, not array destructuring: this function is extracted
          // via .toString() and run inside a Web Worker in total isolation.
          const neighbors: [number, number][] = [
            [ci - 1, cj],
            [ci + 1, cj],
            [ci, cj - 1],
            [ci, cj + 1],
          ]
          for (let neighborIndex = 0; neighborIndex < neighbors.length; neighborIndex++) {
            const ni = neighbors[neighborIndex][0]
            const nj = neighbors[neighborIndex][1]
            if (ni < 0 || nj < 0 || ni >= gridSize || nj >= gridSize) continue
            const nIdx = ni * gridSize + nj
            if (visited[nIdx] || terrainMap[ni][nj] === 2) continue
            visited[nIdx] = 1
            component.push(nIdx)
            stack.push(nIdx)
          }
        }
        if (!bestComponent || component.length > bestComponent.length) bestComponent = component
      }
    }
    if (!bestComponent) return
    const mainland = new Uint8Array(gridSize * gridSize)
    for (let componentIndex = 0; componentIndex < bestComponent.length; componentIndex++) {
      mainland[bestComponent[componentIndex]] = 1
    }
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        if (terrainMap[i][j] !== 2 && !mainland[i * gridSize + j]) terrainMap[i][j] = 2
      }
    }
  }
  removeDisconnectedLand()

  function forceOuterWater(): void {
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        if (
          i < borderWaterWidth ||
          j < borderWaterWidth ||
          i >= gridSize - borderWaterWidth ||
          j >= gridSize - borderWaterWidth
        ) {
          terrainMap[i][j] = 2
        }
      }
    }
  }

  function featureCount(baseCount: number): number {
    return Math.max(0, Math.round(baseCount * Math.max(1, gridSize / 144)))
  }

  function randomRange(min: number, max: number, salt: number): number {
    return min + hash(salt * 12.9898 + 78.233, salt * 37.719 + 11.17) * (max - min)
  }

  function randomInt(min: number, max: number, salt: number): number {
    return Math.floor(randomRange(min, max + 1, salt))
  }

  function normalizedShapeDistance(di: number, dj: number, radius: number, shapeIndex: number): number {
    const angle = Math.atan2(dj, di)
    const rx = radius * (shapeIndex === 1 ? 1.35 : shapeIndex === 2 ? 0.85 : 1.05)
    const ry = radius * (shapeIndex === 1 ? 0.85 : shapeIndex === 2 ? 1.25 : 0.95)
    const bend = shapeIndex === 3 ? Math.sin(angle * 2) * radius * 0.18 : 0
    const x = (di + bend) / rx
    const y = (dj - (shapeIndex === 2 ? Math.cos(angle) * radius * 0.12 : 0)) / ry
    return Math.sqrt(x * x + y * y)
  }

  function isInteriorNonWaterTerrainCell(i: number, j: number, margin = 2): boolean {
    return (
      i >= borderWaterWidth + margin &&
      j >= borderWaterWidth + margin &&
      i < gridSize - borderWaterWidth - margin &&
      j < gridSize - borderWaterWidth - margin &&
      terrainMap[i]?.[j] !== 2
    )
  }

  function applyGroundPatch(
    centerI: number,
    centerJ: number,
    radius: number,
    terrainValue: TerrainGrid[number][number],
    salt: number
  ): void {
    const shapeIndex = randomInt(0, 3, salt + 17)
    const lobeCount = randomInt(1, 3, salt + 23)
    const lobeAngles = [randomRange(0, Math.PI * 2, salt + 31), randomRange(0, Math.PI * 2, salt + 37)]
    const lobeOffsets = [
      randomRange(radius * 0.18, radius * 0.42, salt + 41),
      randomRange(radius * 0.16, radius * 0.36, salt + 43),
    ]
    const lobeRadii = [
      randomRange(radius * 0.42, radius * 0.72, salt + 47),
      randomRange(radius * 0.34, radius * 0.58, salt + 53),
    ]
    const maxRadius = Math.ceil(radius * 2)
    const patchCells: Array<[number, number]> = []
    for (let di = -maxRadius; di <= maxRadius; di++) {
      for (let dj = -maxRadius; dj <= maxRadius; dj++) {
        const ni = centerI + di
        const nj = centerJ + dj
        if (!isInteriorNonWaterTerrainCell(ni, nj)) continue
        let edge = normalizedShapeDistance(di, dj, radius, shapeIndex)
        for (let lobeIndex = 0; lobeIndex < lobeCount - 1; lobeIndex++) {
          const angle = lobeAngles[lobeIndex]
          const li = Math.cos(angle) * lobeOffsets[lobeIndex]
          const lj = Math.sin(angle) * lobeOffsets[lobeIndex]
          edge = Math.min(edge, normalizedShapeDistance(di - li, dj - lj, lobeRadii[lobeIndex], shapeIndex))
        }
        const angle = Math.atan2(dj, di)
        const contour =
          Math.sin(angle * 2 + randomRange(-Math.PI, Math.PI, salt + 59)) * 0.1 +
          Math.sin(angle * 5 + randomRange(-Math.PI, Math.PI, salt + 61)) * 0.06
        const coarseNoise = (hash(ni * 0.37 + salt, nj * 0.37 - salt) - 0.5) * 0.28
        const fineNoise = (hash(ni * 1.17 - salt, nj * 1.17 + salt) - 0.5) * 0.16
        const porousEdge = edge > 0.72 && hash(ni * 2.19 + salt, nj * 2.19 - salt) < (edge - 0.72) * 0.45
        if (edge + contour + coarseNoise + fineNoise <= 1 && !porousEdge) {
          patchCells.push([ni, nj])
        }
      }
    }
    const shouldKeep = (i: number, j: number): boolean => {
      let neighbours = 0
      for (let ai = -1; ai <= 1; ai++) {
        for (let aj = -1; aj <= 1; aj++) {
          if (ai === 0 && aj === 0) continue
          if (terrainMap[i + ai]?.[j + aj] === terrainValue) neighbours++
        }
      }
      return neighbours >= 2
    }
    for (let index = 0; index < patchCells.length; index++) {
      const cell = patchCells[index]
      terrainMap[cell[0]][cell[1]] = terrainValue
    }
    for (let index = 0; index < patchCells.length; index++) {
      const cell = patchCells[index]
      if (!shouldKeep(cell[0], cell[1])) terrainMap[cell[0]][cell[1]] = groundTypeValue
    }
  }

  function applyLake(
    centerI: number,
    centerJ: number,
    radius: number,
    shoreRadius: number,
    shoreValue: TerrainGrid[number][number] | null,
    salt: number
  ): void {
    const shapeIndex = randomInt(0, 3, salt + 29)
    const maxRadius = Math.ceil(radius + shoreRadius + 2)
    const lakeCells: Array<[number, number]> = []
    for (let di = -maxRadius; di <= maxRadius; di++) {
      for (let dj = -maxRadius; dj <= maxRadius; dj++) {
        const ni = centerI + di
        const nj = centerJ + dj
        if (
          ni < borderWaterWidth + maxRadius ||
          nj < borderWaterWidth + maxRadius ||
          ni >= gridSize - borderWaterWidth - maxRadius ||
          nj >= gridSize - borderWaterWidth - maxRadius
        ) {
          continue
        }
        const edge = normalizedShapeDistance(di, dj, radius, shapeIndex)
        const roughness = (hash(ni * 0.51 + salt, nj * 0.51 - salt) - 0.5) * 0.28
        if (edge + roughness <= 1) {
          lakeCells.push([ni, nj])
          terrainMap[ni][nj] = 2
        }
      }
    }
    if (!lakeCells.length || shoreValue == null || shoreRadius <= 0) return
    for (let di = -maxRadius; di <= maxRadius; di++) {
      for (let dj = -maxRadius; dj <= maxRadius; dj++) {
        const ni = centerI + di
        const nj = centerJ + dj
        if (!isInteriorNonWaterTerrainCell(ni, nj)) continue
        const edge = normalizedShapeDistance(di, dj, radius, shapeIndex)
        const roughness = (hash(ni * 0.61 + salt, nj * 0.61 - salt) - 0.5) * 0.35
        if (edge > 1 && edge <= 1 + shoreRadius / Math.max(radius, 1) + roughness) terrainMap[ni][nj] = shoreValue
      }
    }
  }

  const lakes = params.lakes
  if (lakes && lakes.count > 0) {
    const shoreValue = lakes.shoreType ? terrainValueByType[lakes.shoreType] : null
    for (let index = 0; index < featureCount(lakes.count); index++) {
      const salt = 5000 + index * 43
      const margin = borderWaterWidth + Math.ceil(lakes.maxRadius + lakes.shoreRadius) + 5
      const centerI = randomInt(margin, gridSize - margin - 1, salt)
      const centerJ = randomInt(margin, gridSize - margin - 1, salt + 11)
      const radius = randomRange(lakes.minRadius, lakes.maxRadius, salt + 19)
      applyLake(centerI, centerJ, radius, lakes.shoreRadius, shoreValue, salt)
    }
  }

  function hasWaterWithin(centerI: number, centerJ: number, distance: number): boolean {
    const r = Math.ceil(distance)
    const distanceSq = distance * distance
    for (let di = -r; di <= r; di++) {
      for (let dj = -r; dj <= r; dj++) {
        if (di * di + dj * dj > distanceSq) continue
        if (terrainMap[centerI + di]?.[centerJ + dj] === 2) return true
      }
    }
    return false
  }

  const patchwork = params.patchwork
  if (patchwork && patchwork.count > 0) {
    const terrainValue = terrainValueByType[patchwork.terrainType]
    const requireWaterClearance = patchwork.terrainType === 'Dirt' || patchwork.terrainType === 'Snow'
    for (let index = 0; index < featureCount(patchwork.count); index++) {
      const salt = 1000 + index * 31
      const margin = borderWaterWidth + Math.ceil(patchwork.maxRadius) + 4
      const radius = randomRange(patchwork.minRadius, patchwork.maxRadius, salt + 13)
      const waterClearance = Math.ceil(radius * 1.5) + 3
      let centerI = 0
      let centerJ = 0
      let placed = false
      for (let attempt = 0; attempt < 12; attempt++) {
        const attemptSalt = salt + attempt * 101
        centerI = randomInt(margin, gridSize - margin - 1, attemptSalt)
        centerJ = randomInt(margin, gridSize - margin - 1, attemptSalt + 7)
        if (!requireWaterClearance || !hasWaterWithin(centerI, centerJ, waterClearance)) {
          placed = true
          break
        }
      }
      if (placed) applyGroundPatch(centerI, centerJ, radius, terrainValue, salt)
    }
  }

  forceOuterWater()

  return { seed: resolvedSeed, terrain: terrainMap }
}
