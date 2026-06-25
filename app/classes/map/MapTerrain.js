import { Assets, Container, Sprite } from 'pixi.js'
import { cartesianToIsometric, getCellsAroundPoint, getPlainCellsAroundPoint } from '../../lib'
import { CELL_DEPTH } from '../../constants'
import {
  EIGHT_NEIGHBOR_OFFSETS,
  getCyclicGroups,
  getNeighborFlags,
  getNeighborFlagsFromRing,
  getNeighborRing,
  getWaterBorderFrame,
  hasUnsupportedTransition,
} from '../../lib/terrain/topology'

export class MapTerrain {
  constructor(map) {
    this.map = map
    this.reliefCoastDistances = null
    this.reliefCoastDistancesSize = 0
  }

  generateMapRelief() {
    const seed = Number.isFinite(this.map.seed) ? this.map.seed : Math.random() * 9999

    function hash(x, y, offset = 0) {
      const n = Math.sin(x * 83.7 + y * 214.3 + (seed + offset) * 5.1) * 43758.5453
      return n - Math.floor(n)
    }
    function noise(x, y, offset = 0) {
      const xi = Math.floor(x),
        yi = Math.floor(y)
      const xf = x - xi,
        yf = y - yi
      const s = t => t * t * (3 - 2 * t)
      const u = s(xf),
        v = s(yf)
      const a = hash(xi, yi, offset),
        b = hash(xi + 1, yi, offset)
      const c = hash(xi, yi + 1, offset),
        d = hash(xi + 1, yi + 1, offset)
      return a + (b - a) * u + (c - a) * v + (d + a - b - c) * u * v
    }
    function fbm(x, y, offset = 0) {
      let val = 0,
        amp = 0.5,
        freq = 1,
        sum = 0
      for (let o = 0; o < 5; o++) {
        val += noise(x * freq, y * freq, offset + o * 19.7) * amp
        sum += amp
        amp *= 0.52
        freq *= 1.95
      }
      return val / sum
    }

    const n = this.map.size + 1
    const dist = this.map.getReliefCoastDistances()
    const reliefH = new Float32Array(n * n)
    const landHeights = []
    const scale = 4.5 / this.map.size

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const x = i * scale
        const y = j * scale
        const warpX = (fbm(x * 0.55, y * 0.55, 101) - 0.5) * 1.35
        const warpY = (fbm(x * 0.55, y * 0.55, 307) - 0.5) * 1.35
        const broadRelief = fbm(x + warpX, y + warpY, 503)
        const localRelief = fbm(x * 1.8 + warpX * 0.45, y * 1.8 + warpY * 0.45, 709)
        const height = broadRelief * 0.78 + localRelief * 0.22
        const index = i * n + j
        const cell = this.map.grid[i][j]

        reliefH[index] = height
        if (cell.category !== 'Water' && !cell.has && !cell.waterBorder) landHeights.push(height)
      }
    }

    landHeights.sort((a, b) => a - b)
    const getQuantile = ratio => landHeights[Math.min(landHeights.length - 1, Math.floor(landHeights.length * ratio))]
    const reliefBands = [
      [0.01, -4],
      [0.035, -3],
      [0.09, -2],
      [0.21, -1],
      [0.79, 0],
      [0.91, 1],
      [0.965, 2],
      [0.99, 3],
      [1, 4],
    ].map(([ratio, level]) => [getQuantile(ratio), level])

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell.category === 'Water' || cell.has || cell.waterBorder) continue

        const index = i * n + j
        const matchingBand = reliefBands.find(([threshold]) => reliefH[index] <= threshold)
        const level = matchingBand?.[1] ?? 4
        const minAllowed = this.map.getMinReliefLevelFromCoastDistance(dist[index])
        const maxAllowed = this.map.getMaxReliefLevelFromCoastDistance(dist[index])
        const targetLevel = Math.max(minAllowed, Math.min(maxAllowed, level))
        if (targetLevel !== cell.z) {
          this.map.setCellReliefLevelDirect(cell, targetLevel)
        }
      }
    }

    this.map.clampReliefAroundWater(dist)

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell.z === 1) {
          let cpt = 0
          getCellsAroundPoint(i, j, this.map.grid, 1, c => {
            if (c.z > 0) cpt++
          })
          if (cpt < 3) this.map.setCellReliefLevelDirect(cell, 0)
        } else if (cell.z === -1) {
          let cpt = 0
          getCellsAroundPoint(i, j, this.map.grid, 1, c => {
            if (c.z < 0) cpt++
          })
          if (cpt < 3) this.map.setCellReliefLevelDirect(cell, 0)
        }
      }
    }

    this.map.flattenPlayerStartZones()
    this.map.clampReliefAroundWater(dist)
  }

  flattenPlayerStartZones(radius = 4) {
    for (const pos of this.map.playersPos) {
      const cells = getPlainCellsAroundPoint(pos.i, pos.j, this.map.grid, radius).filter(
        cell => cell.category !== 'Water' && !cell.waterBorder
      )
      const zCounts = {}
      for (const cell of cells) zCounts[cell.z] = (zCounts[cell.z] || 0) + 1
      const targetZ = Number(Object.entries(zCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0)
      for (const cell of cells) {
        if (cell.z !== targetZ) this.map.setCellReliefLevelDirect(cell, targetZ)
      }
    }
  }

  getReliefCoastDistances() {
    const n = this.map.size + 1
    if (this.reliefCoastDistances && this.reliefCoastDistancesSize === n) {
      return this.reliefCoastDistances
    }

    const dist = new Int16Array(n * n).fill(9999)
    const queue = []

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell.category === 'Water' || cell.waterBorder) {
          dist[i * n + j] = 0
          queue.push(i * n + j)
        }
      }
    }

    for (let qi = 0; qi < queue.length; qi++) {
      const idx = queue[qi]
      const ci = Math.floor(idx / n),
        cj = idx % n
      const d = dist[idx]
      for (const [di, dj] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const ni = ci + di,
          nj = cj + dj
        if (ni < 0 || ni > this.map.size || nj < 0 || nj > this.map.size) continue
        const nidx = ni * n + nj
        if (dist[nidx] > d + 1) {
          dist[nidx] = d + 1
          queue.push(nidx)
        }
      }
    }

    this.reliefCoastDistances = dist
    this.reliefCoastDistancesSize = n
    return dist
  }

  invalidateReliefCoastDistances() {
    this.reliefCoastDistances = null
    this.reliefCoastDistancesSize = 0
  }

  getMaxReliefLevelFromCoastDistance(distance) {
    return Math.max(0, distance - 3)
  }

  getMinReliefLevelFromCoastDistance(distance) {
    return -this.map.getMaxReliefLevelFromCoastDistance(distance)
  }

  setCellReliefLevelDirect(cell, level) {
    const delta = level - cell.z
    if (delta === 0) return
    cell.y -= delta * CELL_DEPTH
    cell.z = level
  }

  flattenWaterComponents(seeds, level) {
    const visited = new Set()
    const queue = [...seeds]

    for (let index = 0; index < queue.length; index++) {
      const cell = queue[index]
      if (!cell || visited.has(cell) || cell.category !== 'Water') continue
      visited.add(cell)
      this.map.setCellReliefLevelDirect(cell, level)

      for (const [di, dj] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const neighbor = this.map.grid[cell.i + di]?.[cell.j + dj]
        if (neighbor?.category === 'Water' && !visited.has(neighbor)) queue.push(neighbor)
      }
    }
  }

  fillWaterGaps(level = null) {
    const filledCells = new Set()
    const queue = []
    const queued = new Set()

    const enqueue = cell => {
      if (!cell || queued.has(cell)) return
      queued.add(cell)
      queue.push(cell)
    }

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell.category === 'Water') enqueue(cell)
      }
    }

    for (let index = 0; index < queue.length; index++) {
      const cell = queue[index]
      for (const [di, dj] of [
        [-2, 0],
        [2, 0],
        [0, -2],
        [0, 2],
      ]) {
        if (this.map.grid[cell.i + di]?.[cell.j + dj]?.category !== 'Water') continue
        const middle = this.map.grid[cell.i + di / 2]?.[cell.j + dj / 2]
        if (middle?.category === 'Water') continue
        if (level != null) this.map.setCellReliefLevelDirect(middle, level)
        middle.setWater()
        filledCells.add(middle)
        enqueue(middle)
      }
    }

    if (filledCells.size) this.invalidateReliefCoastDistances()
    return filledCells
  }

  normalizeWaterTopology(level = null, seeds = null, protectedCells = new Set(), pass = 0) {
    const cellsToFill = []
    const cellsToLand = []
    const candidates = new Set()

    if (seeds?.size) {
      for (const seed of seeds) {
        for (let di = -1; di <= 1; di++) {
          for (let dj = -1; dj <= 1; dj++) {
            const candidate = this.map.grid[seed.i + di]?.[seed.j + dj]
            if (candidate) candidates.add(candidate)
          }
        }
      }
    } else {
      for (let i = 0; i <= this.map.size; i++) {
        for (let j = 0; j <= this.map.size; j++) candidates.add(this.map.grid[i][j])
      }
    }

    for (const cell of candidates) {
      if (cell.category === 'Water') continue
      const { i, j } = cell
      const waterRing = getNeighborRing(this.map.grid, i, j, neighbor => neighbor?.category === 'Water')
      if (waterRing.filter(Boolean).length < 2) continue
      const waterNeighbors = getNeighborFlagsFromRing(waterRing)
      if (!hasUnsupportedTransition(waterNeighbors)) continue

      if (protectedCells.has(cell)) {
        for (let index = 0; index < waterRing.length; index++) {
          if (!waterRing[index]) continue
          const [di, dj] = EIGHT_NEIGHBOR_OFFSETS[index]
          const neighbor = this.map.grid[i + di]?.[j + dj]
          if (neighbor && !protectedCells.has(neighbor)) cellsToLand.push([neighbor, cell.type])
        }
        continue
      }

      const hasProtectedWaterNeighbor = EIGHT_NEIGHBOR_OFFSETS.some(([di, dj]) =>
        protectedCells.has(this.map.grid[i + di]?.[j + dj])
      )
      if (hasProtectedWaterNeighbor) {
        cellsToFill.push(cell)
        continue
      }

      const groups = getCyclicGroups(waterRing)
      if (groups.length < 2) continue

      const largestGroup = groups.reduce((largest, group) => (group.length > largest.length ? group : largest))
      const removalCost = waterRing.filter(Boolean).length - largestGroup.length

      // Prefer the smallest local edit. Ties favour removing a stray water
      // fragment, so deleting water is never silently undone by this pass.
      if (removalCost <= 1) {
        for (const group of groups) {
          if (group === largestGroup) continue
          for (const index of group) {
            const [di, dj] = EIGHT_NEIGHBOR_OFFSETS[index]
            const neighbor = this.map.grid[i + di]?.[j + dj]
            if (neighbor?.category === 'Water' && !protectedCells.has(neighbor)) cellsToLand.push([neighbor, cell.type])
          }
        }
      } else if (!protectedCells.has(cell)) {
        cellsToFill.push(cell)
      }
    }

    const changedCells = new Set()
    for (const [cell, type] of cellsToLand) {
      if (cell.category !== 'Water') continue
      cell.setTerrainType(type)
      changedCells.add(cell)
    }
    for (const cell of cellsToFill) {
      if (cell.category === 'Water') continue
      if (level != null) this.map.setCellReliefLevelDirect(cell, level)
      cell.setWater()
      changedCells.add(cell)
    }
    if (changedCells.size) this.invalidateReliefCoastDistances()

    // A correction can expose an invalid neighbour one ring farther out. Run
    // to a bounded fixed point now, instead of waiting for the next stroke to
    // incidentally repair it.
    const maxPasses = Math.max(4, Math.min(24, this.map.size + 1))
    if (changedCells.size && pass < maxPasses) {
      const subsequentChanges = this.normalizeWaterTopology(level, changedCells, protectedCells, pass + 1)
      for (const cell of subsequentChanges) changedCells.add(cell)
    }

    return changedCells
  }

  clampReliefAroundWaterLevels() {
    const n = this.map.size + 1
    const dist = new Int16Array(n * n).fill(9999)
    const waterLevel = new Int16Array(n * n)
    const minLevels = new Int16Array(n * n).fill(-32768)
    const maxLevels = new Int16Array(n * n).fill(32767)
    const queue = []

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell.category !== 'Water') continue
        const index = i * n + j
        dist[index] = 0
        waterLevel[index] = cell.z
        queue.push(index)
      }
    }

    for (let qi = 0; qi < queue.length; qi++) {
      const index = queue[qi]
      const i = Math.floor(index / n)
      const j = index % n
      for (const [di, dj] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const ni = i + di
        const nj = j + dj
        if (ni < 0 || ni > this.map.size || nj < 0 || nj > this.map.size) continue
        const neighborIndex = ni * n + nj
        if (dist[neighborIndex] <= dist[index] + 1) continue
        dist[neighborIndex] = dist[index] + 1
        waterLevel[neighborIndex] = waterLevel[index]
        queue.push(neighborIndex)
      }
    }

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const index = i * n + j
        if (dist[index] === 9999) continue
        const cell = this.map.grid[i][j]
        const range = this.map.getMaxReliefLevelFromCoastDistance(dist[index])
        const minAllowed = waterLevel[index] - range
        const maxAllowed = waterLevel[index] + range
        minLevels[index] = minAllowed
        maxLevels[index] = maxAllowed
        if (cell.z < minAllowed) this.map.setCellReliefLevelDirect(cell, minAllowed)
        if (cell.z > maxAllowed) this.map.setCellReliefLevelDirect(cell, maxAllowed)
      }
    }

    return { minLevels, maxLevels }
  }

  rebuildTerrainBackfill() {
    let layer = this.map.terrainBackfill
    if (!layer) {
      layer = new Container()
      layer.label = 'terrainBackfill'
      layer.eventMode = 'none'
      layer.zIndex = -2
      layer.sortableChildren = true
      this.map.terrainBackfill = layer
    }

    if (layer.parent !== this.map) this.map.addChild(layer)
    for (const child of layer.removeChildren()) child.destroy()
    layer.visible = true

    const config = Assets.cache.get('config')
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        const isMapEdge = i === 0 || j === 0 || i === this.map.size || j === this.map.size
        if (!isMapEdge || cell.z === 0) continue

        const assets = config?.cells?.[cell.type]?.assets || []
        if (!assets.length) continue

        const textureName = assets[(i * 31 + j * 17) % assets.length]
        const resourceName = textureName.split('_')[1]
        const texture = Assets.cache.get(resourceName)?.textures?.[textureName + '.png']
        if (!texture) continue

        const [x, y] = cartesianToIsometric(i, j)
        const addBackfillSprite = level => {
          const sprite = new Sprite(texture)
          sprite.x = x
          sprite.y = y - level * CELL_DEPTH
          sprite.zIndex = i + j + level / 10
          sprite.anchor.set(
            Math.floor(texture.width / 2) / texture.width,
            Math.floor(texture.height / 2) / texture.height
          )
          sprite.roundPixels = true
          sprite.eventMode = 'none'
          layer.addChild(sprite)
        }

        // At the map perimeter there is no neighboring tile behind the relief.
        addBackfillSprite(0)
        const direction = Math.sign(cell.z)
        for (let level = direction; level !== cell.z + direction; level += direction) {
          addBackfillSprite(level)
        }
      }
    }
  }

  clampReliefAroundWater(dist = this.map.getReliefCoastDistances()) {
    const n = this.map.size + 1
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        const maxAllowed = this.map.getMaxReliefLevelFromCoastDistance(dist[i * n + j])
        const minAllowed = this.map.getMinReliefLevelFromCoastDistance(dist[i * n + j])
        if (cell.z > maxAllowed) this.map.setCellReliefLevelDirect(cell, maxAllowed)
        if (cell.z < minAllowed) this.map.setCellReliefLevelDirect(cell, minAllowed)
      }
    }
  }

  enforceReliefStepContinuity(
    dist = this.map.getReliefCoastDistances(),
    protectedCells = new Set(),
    levelBounds = null
  ) {
    const n = this.map.size + 1
    const diagonalDirections = EIGHT_NEIGHBOR_OFFSETS
    const getLevelBounds = cell => {
      const index = cell.i * n + cell.j
      if (levelBounds) {
        return {
          min: levelBounds.minLevels[index],
          max: levelBounds.maxLevels[index],
        }
      }
      return {
        min: this.map.getMinReliefLevelFromCoastDistance(dist[index]),
        max: this.map.getMaxReliefLevelFromCoastDistance(dist[index]),
      }
    }
    let deepestLevel = 0

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        deepestLevel = Math.min(deepestLevel, this.map.grid[i][j].z)
      }
    }

    // The slope atlas cannot represent checkerboard-like concave contours.
    // Close one-cell gaps at each negative depth while preserving the basin outline.
    for (let level = deepestLevel; level < 0; level++) {
      const depthMask = new Uint8Array(n * n)
      const expandedMask = new Uint8Array(n * n)

      for (let i = 0; i <= this.map.size; i++) {
        for (let j = 0; j <= this.map.size; j++) {
          const cell = this.map.grid[i][j]
          if (cell.category !== 'Water' && !cell.waterBorder && cell.z <= level) {
            depthMask[i * n + j] = 1
          }
        }
      }

      for (let i = 0; i <= this.map.size; i++) {
        for (let j = 0; j <= this.map.size; j++) {
          const index = i * n + j
          if (depthMask[index]) {
            expandedMask[index] = 1
            continue
          }

          expandedMask[index] = Number(
            diagonalDirections.some(([di, dj]) => {
              const ni = i + di
              const nj = j + dj
              return ni >= 0 && ni <= this.map.size && nj >= 0 && nj <= this.map.size && depthMask[ni * n + nj] === 1
            })
          )
        }
      }

      const adjustments = []
      for (let i = 0; i <= this.map.size; i++) {
        for (let j = 0; j <= this.map.size; j++) {
          const cell = this.map.grid[i][j]
          if (cell.category === 'Water' || cell.waterBorder || cell.has || protectedCells.has(cell) || cell.z <= level)
            continue

          const closesGap = diagonalDirections.every(([di, dj]) => {
            const ni = i + di
            const nj = j + dj
            return ni < 0 || ni > this.map.size || nj < 0 || nj > this.map.size || expandedMask[ni * n + nj] === 1
          })
          if (expandedMask[i * n + j] && closesGap) adjustments.push(cell)
        }
      }

      for (const cell of adjustments) {
        this.map.setCellReliefLevelDirect(cell, level)
      }
    }

    const noDepressionLimit = 32767
    const depressionUpperBounds = new Int16Array(n * n).fill(noDepressionLimit)
    const queue = []

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell.category === 'Water' || cell.waterBorder || cell.z >= 0) continue
        depressionUpperBounds[i * n + j] = cell.z
        queue.push(cell)
      }
    }

    for (let index = 0; index < queue.length; index++) {
      const cell = queue[index]
      const nextBound = depressionUpperBounds[cell.i * n + cell.j] + 1

      for (const [di, dj] of diagonalDirections) {
        const neighbor = this.map.grid[cell.i + di]?.[cell.j + dj]
        if (!neighbor || neighbor.category === 'Water' || neighbor.waterBorder) continue
        const neighborIndex = neighbor.i * n + neighbor.j
        if (depressionUpperBounds[neighborIndex] <= nextBound) continue
        depressionUpperBounds[neighborIndex] = nextBound
        queue.push(neighbor)
      }
    }

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell.category === 'Water' || cell.waterBorder) continue
        const upperBound = depressionUpperBounds[i * n + j]
        if (!protectedCells.has(cell) && upperBound < cell.z) {
          this.map.setCellReliefLevelDirect(cell, upperBound)
        }
      }
    }

    const getHigherNeighbors = cell =>
      getNeighborFlags(this.map.grid, cell.i, cell.j, neighbor => Boolean(neighbor && neighbor.z > cell.z))

    const enforceHeightSteps = () => {
      let changed = false

      for (let i = 0; i <= this.map.size; i++) {
        for (let j = 0; j <= this.map.size; j++) {
          const cell = this.map.grid[i][j]
          const neighbors = [
            this.map.grid[i]?.[j + 1],
            this.map.grid[i + 1]?.[j - 1],
            this.map.grid[i + 1]?.[j],
            this.map.grid[i + 1]?.[j + 1],
          ]

          for (const neighbor of neighbors) {
            if (!neighbor) continue
            if (cell.category === 'Water' || neighbor.category === 'Water' || cell.waterBorder || neighbor.waterBorder)
              continue

            const high = cell.z >= neighbor.z ? cell : neighbor
            const low = high === cell ? neighbor : cell
            if (high.z - low.z <= 1) continue

            const lowBounds = getLevelBounds(low)
            const highBounds = getLevelBounds(high)
            const lowMaxAllowed = lowBounds.max
            const lowMinAllowed = lowBounds.min
            const highMaxAllowed = highBounds.max
            const highMinAllowed = highBounds.min
            const targetLowLevel = high.z - 1
            const targetHighLevel = Math.max(highMinAllowed, Math.min(highMaxAllowed, low.z + 1))
            const lowDepressionLimit = depressionUpperBounds[low.i * n + low.j]
            const boundedTargetLowLevel = Math.min(targetLowLevel, lowDepressionLimit)
            const highProtected = protectedCells.has(high)
            const lowProtected = protectedCells.has(low)
            const previousHighLevel = high.z
            const previousLowLevel = low.z

            if (highProtected && lowProtected) continue
            if (lowProtected) {
              this.map.setCellReliefLevelDirect(high, targetHighLevel)
            } else {
              const target = highProtected ? targetLowLevel : boundedTargetLowLevel
              if (!low.has && target > low.z && target >= lowMinAllowed && target <= lowMaxAllowed) {
                this.map.setCellReliefLevelDirect(low, target)
              } else if (!highProtected) {
                this.map.setCellReliefLevelDirect(high, targetHighLevel)
              }
            }

            if (high.z !== previousHighLevel || low.z !== previousLowLevel) changed = true
          }
        }
      }

      return changed
    }

    const raiseUnsupportedTransitions = isUnsupported => {
      const adjustments = []

      for (let i = 0; i <= this.map.size; i++) {
        for (let j = 0; j <= this.map.size; j++) {
          const cell = this.map.grid[i][j]
          if (cell.category === 'Water' || cell.waterBorder || protectedCells.has(cell)) continue
          if (!isUnsupported(getHigherNeighbors(cell))) continue

          const higherLevels = diagonalDirections
            .map(([di, dj]) => this.map.grid[i + di]?.[j + dj])
            .filter(neighbor => neighbor && neighbor.z > cell.z)
            .map(neighbor => neighbor.z)
          if (!higherLevels.length) continue

          const maxAllowed = getLevelBounds(cell).max
          // Preserving the exact bottom of a depression is less important than
          // producing a contour the sprite atlas can represent. Keeping the
          // depression bound here left enclosed negative cells permanently invalid.
          const targetLevel = Math.min(Math.min(...higherLevels), maxAllowed)
          if (targetLevel > cell.z) adjustments.push([cell, targetLevel])
        }
      }

      for (const [cell, targetLevel] of adjustments) {
        this.map.setCellReliefLevelDirect(cell, targetLevel)
      }
      return adjustments.length > 0
    }

    let changed = true
    let pass = 0
    const maxPasses = Math.max(12, Math.min(64, this.map.size + 1))
    while (changed && pass++ < maxPasses) {
      changed = enforceHeightSteps()
      changed = raiseUnsupportedTransitions(hasUnsupportedTransition) || changed
    }
  }

  formatCellsRelief() {
    // Cell-local underlays cover transparent relief frames. This layer only closes
    // the exposed vertical stack at the outer perimeter of the map.
    this.rebuildTerrainBackfill()

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell.category === 'Water' || cell.waterBorder) continue

        const { n, s, w, e, nw, ne, sw, se } = getNeighborFlags(
          this.map.grid, i, j, neighbor => (neighbor?.z ?? cell.z) > cell.z
        )

        // Cardinal singles
        if (n && !s && !w && !e) {
          cell.setReliefBorder('014', CELL_DEPTH / 2)
        } else if (s && !n && !w && !e) {
          cell.setReliefBorder('015', CELL_DEPTH / 2)
        } else if (w && !n && !s && !e) {
          cell.setReliefBorder('016', CELL_DEPTH / 2)
        } else if (e && !n && !s && !w) {
          cell.setReliefBorder('013', CELL_DEPTH / 2)
          // Diagonal singles — only fire when adjacent cardinals are not higher
        } else if (nw && !n && !w) {
          cell.setReliefBorder('010', CELL_DEPTH / 2)
        } else if (sw && !s && !w) {
          cell.setReliefBorder('012')
        } else if (ne && !n && !e) {
          cell.setReliefBorder('011')
        } else if (se && !s && !e) {
          cell.setReliefBorder('009', CELL_DEPTH / 2)
          // Cardinal pairs (exact) — guards on opposite directions fix the z=2 corner bug
        } else if (w && n && !s && !e) {
          cell.setReliefBorder('022', CELL_DEPTH / 2)
        } else if (e && s && !n && !w) {
          cell.setReliefBorder('021', CELL_DEPTH / 2)
        } else if (w && s && !n && !e) {
          cell.setReliefBorder('023', CELL_DEPTH)
        } else if (e && n && !s && !w) {
          cell.setReliefBorder('024', CELL_DEPTH)
        } else if (n && s && !w && !e) {
          cell.setReliefBorder('017', CELL_DEPTH / 2)
        } else if (w && e && !n && !s) {
          cell.setReliefBorder('018', CELL_DEPTH / 2)
          // 3+ cardinals higher — approximate with the most visually dominant pair
        } else if (n && w) {
          cell.setReliefBorder('022', CELL_DEPTH / 2)
        } else if (s && e) {
          cell.setReliefBorder('021', CELL_DEPTH / 2)
        } else if (w && s) {
          cell.setReliefBorder('023', CELL_DEPTH)
        } else if (e && n) {
          cell.setReliefBorder('024', CELL_DEPTH)
        } else if (n || s) {
          cell.setReliefBorder('017', CELL_DEPTH / 2)
        } else if (w || e) {
          cell.setReliefBorder('018', CELL_DEPTH / 2)
        } else if (nw || ne || sw || se) {
          console.log(`[relief] UNHANDLED diagonal at [${i},${j}] z=${cell.z} NW=${nw} NE=${ne} SW=${sw} SE=${se}`)
        }
      }
    }
  }

  formatCellsWaterBorder() {
    const isAnyWater = type => type === 'Water' || type === 'DeepWater'
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell.category === 'Water') continue
        const flags = getNeighborFlags(this.map.grid, i, j, neighbor => isAnyWater(neighbor?.type))
        const frame = getWaterBorderFrame(flags)
        if (frame) cell.setWaterBorder('20000', frame)
      }
    }
  }

  formatCellsWaterBorderOverlays() {
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (!cell.waterBorder) continue

        const overlay = (neighbor, direction) => {
          if (neighbor && !neighbor.waterBorder && neighbor.category !== 'Water' && neighbor.type !== 'Desert') {
            neighbor.setDesertBorder(direction)
          }
        }

        overlay(this.map.grid[i - 1]?.[j], 'east')
        overlay(this.map.grid[i + 1]?.[j], 'west')
        overlay(this.map.grid[i]?.[j - 1], 'south')
        overlay(this.map.grid[i]?.[j + 1], 'north')
      }
    }
  }

  rebuildTerrainAppearance(protectedReliefCells = new Set()) {
    const timings = this.map.generationTimings
    const measure = (name, callback) => {
      if (!timings) return callback()
      const startedAt = performance.now()
      const result = callback()
      timings[name] = performance.now() - startedAt
      return result
    }

    measure('terrainResetAppearance', () => {
      const preserveWaterBorder = Boolean(this.map.blueprintWaterBorderReady)
      for (let i = 0; i <= this.map.size; i++) {
        for (let j = 0; j <= this.map.size; j++) {
          this.map.grid[i][j].resetTerrainAppearance({ preserveWaterBorder })
        }
      }
    })

    if (this.map.blueprintWaterBorderReady) {
      this.map.generationTimings.terrainWaterBorder = 0
    } else {
      measure('terrainWaterBorder', () => this.map.formatCellsWaterBorder())
    }
    if (this.map.pregeneratedBlueprintId) {
      this.map.generationTimings.terrainClampWaterLevels = 0
      this.map.generationTimings.terrainReliefContinuity = 0
    } else {
      const waterLevelBounds = measure('terrainClampWaterLevels', () => this.map.clampReliefAroundWaterLevels())
      const unrestrictedReliefDistances = new Int16Array((this.map.size + 1) ** 2).fill(this.map.size + 4)
      measure('terrainReliefContinuity', () =>
        this.map.enforceReliefStepContinuity(unrestrictedReliefDistances, protectedReliefCells, waterLevelBounds)
      )
    }
    measure('terrainReliefBorders', () => this.map.formatCellsRelief())
    measure('terrainWaterBorderOverlays', () => this.map.formatCellsWaterBorderOverlays())
    measure('terrainDeepWaterBorders', () => this.map.formatCellsDeepWaterBorder())
    measure('terrainDesertBorders', () => this.map.formatCellsDesert())
  }

  classifyDeepWater() {
    const MIN_DIST_FROM_LAND = 3
    const mapSeed = Number.isFinite(this.map.seed) ? this.map.seed : 0
    const config = Assets.cache.get('config')
    const deepWaterDef = config?.cells?.['DeepWater']
    const waterDef = config?.cells?.['Water']

    const n = this.map.size + 1
    const dist = new Int16Array(n * n).fill(9999)
    const queue = []

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        if (this.map.grid[i][j].category !== 'Water') {
          const idx = i * n + j
          dist[idx] = 0
          queue.push(idx)
        }
      }
    }

    for (let qi = 0; qi < queue.length; qi++) {
      const idx = queue[qi]
      const ci = Math.floor(idx / n)
      const cj = idx % n
      const d = dist[idx]
      for (const [di, dj] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const ni = ci + di,
          nj = cj + dj
        if (ni < 0 || ni > this.map.size || nj < 0 || nj > this.map.size) continue
        const nidx = ni * n + nj
        if (dist[nidx] > d + 1) {
          dist[nidx] = d + 1
          queue.push(nidx)
        }
      }
    }

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell.category !== 'Water') continue

        const d = dist[i * n + j]
        let isDeep = false
        if (d >= MIN_DIST_FROM_LAND) {
          // Low-frequency noise (period ~30 cells) creates large coherent zones
          const h = Math.sin(i * 0.11 + j * 0.17 + mapSeed * 2.3) * 43758.5453
          const noise = h - Math.floor(h)
          // Threshold drops quickly with distance: at d=3 → 60% deep, d=5 → 90%, d=7+ → 100%
          const threshold = Math.max(0, 0.9 - (d - MIN_DIST_FROM_LAND) * 0.25)
          isDeep = noise > threshold
        }

        cell.type = isDeep ? 'DeepWater' : 'Water'

        const def = isDeep ? deepWaterDef : waterDef
        if (!cell.sprite) {
          if (def?.assets?.length) {
            cell.assets = def.assets
            cell.terrainTextureName = def.assets[(i * 31 + j * 17) % def.assets.length]
          }
          continue
        }
        if (!def?.assets?.length) continue
        const textureName = def.assets[(i * 31 + j * 17) % def.assets.length]
        const resourceName = textureName.split('_')[1]
        const spritesheet = Assets.cache.get(resourceName)
        const texture = spritesheet?.textures?.[textureName + '.png']
        if (!texture) continue
        cell.sprite.texture = texture
        cell.sprite.anchor.set(
          Math.floor(texture.width / 2) / texture.width,
          Math.floor(texture.height / 2) / texture.height
        )
      }
    }
  }

  formatCellsDeepWaterBorder() {
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell.type !== 'DeepWater') continue
        const { n, s, w, e } = getNeighborFlags(
          this.map.grid, i, j, neighbor => neighbor != null && neighbor.type !== 'DeepWater'
        )
        if (n) cell.setDeepWaterBorder('west')
        if (s) cell.setDeepWaterBorder('east')
        if (w) cell.setDeepWaterBorder('north')
        if (e) cell.setDeepWaterBorder('south')
      }
    }
  }

  formatCellsDesert() {
    const typeToFormat = ['Grass', 'Jungle']

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell.type === 'Desert') {
          const n = this.map.grid[i - 1]?.[j]
          const s = this.map.grid[i + 1]?.[j]
          const w = this.map.grid[i]?.[j - 1]
          const e = this.map.grid[i]?.[j + 1]
          if (n && typeToFormat.includes(n.type) && !n.waterBorder) n.setDesertBorder('east')
          if (s && typeToFormat.includes(s.type) && !s.waterBorder) s.setDesertBorder('west')
          if (w && typeToFormat.includes(w.type) && !w.waterBorder) w.setDesertBorder('south')
          if (e && typeToFormat.includes(e.type) && !e.waterBorder) e.setDesertBorder('north')
        }
      }
    }
  }
}
