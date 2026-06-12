import { Assets, Container, Sprite } from 'pixi.js'
import { cartesianToIsometric, getCellsAroundPoint, getPlainCellsAroundPoint } from '../../lib'
import { CELL_DEPTH } from '../../constants'

export class MapTerrain {
  constructor(map) {
    this.map = map
  }

  generateMapRelief() {
    const seed = Math.random() * 9999

    function hash(x, y) {
      const n = Math.sin(x * 83.7 + y * 214.3 + seed * 5.1) * 43758.5453
      return n - Math.floor(n)
    }
    function noise(x, y) {
      const xi = Math.floor(x),
        yi = Math.floor(y)
      const xf = x - xi,
        yf = y - yi
      const s = t => t * t * (3 - 2 * t)
      const u = s(xf),
        v = s(yf)
      const a = hash(xi, yi),
        b = hash(xi + 1, yi)
      const c = hash(xi, yi + 1),
        d = hash(xi + 1, yi + 1)
      return a + (b - a) * u + (c - a) * v + (d + a - b - c) * u * v
    }
    function fbm(x, y) {
      let val = 0,
        amp = 0.5,
        freq = 1,
        sum = 0
      for (let o = 0; o < 4; o++) {
        val += noise(x * freq, y * freq) * amp
        sum += amp
        amp *= 0.5
        freq *= 2
      }
      return val / sum
    }

    const scale = 3 / this.map.size
    const n = this.map.size + 1

    const dist = this.map.getReliefCoastDistances()

    const reliefH = new Float32Array(n * n)
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        reliefH[i * n + j] = fbm(i * scale, j * scale)
      }
    }

    const levelThresholds = [0, 0.66, 0.78, 0.86]
    const depressionThresholds = [1, 0.34, 0.22, 0.14]
    for (let targetLevel = 3; targetLevel >= 1; targetLevel--) {
      const threshold = levelThresholds[targetLevel]
      for (let i = 0; i <= this.map.size; i++) {
        for (let j = 0; j <= this.map.size; j++) {
          const cell = this.map.grid[i][j]
          if (cell.category === 'Water' || cell.has || cell.waterBorder) continue
          const maxAllowed = this.map.getMaxReliefLevelFromCoastDistance(dist[i * n + j])
          const actual = Math.min(targetLevel, maxAllowed)
          if (reliefH[i * n + j] > threshold && actual > cell.z) {
            cell.setCellLevel(actual)
          }
        }
      }
    }

    for (let targetDepth = 3; targetDepth >= 1; targetDepth--) {
      const threshold = depressionThresholds[targetDepth]
      for (let i = 0; i <= this.map.size; i++) {
        for (let j = 0; j <= this.map.size; j++) {
          const cell = this.map.grid[i][j]
          if (cell.category === 'Water' || cell.has || cell.waterBorder || cell.z > 0) continue
          const minAllowed = this.map.getMinReliefLevelFromCoastDistance(dist[i * n + j])
          const actual = Math.max(-targetDepth, minAllowed)
          if (reliefH[i * n + j] < threshold && actual < cell.z) {
            this.map.setCellReliefLevelDirect(cell, actual)
          }
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

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        this.map.grid[i][j].fillReliefCellsAroundCell()
      }
    }
    this.map.flattenPlayerStartZones()
    this.map.clampReliefAroundWater(dist)
    this.map.enforceReliefStepContinuity(dist)
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

    return dist
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

  clampReliefAroundWaterLevels() {
    const n = this.map.size + 1
    const dist = new Int16Array(n * n).fill(9999)
    const waterLevel = new Int16Array(n * n)
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
        if (cell.z < minAllowed) this.map.setCellReliefLevelDirect(cell, minAllowed)
        if (cell.z > maxAllowed) this.map.setCellReliefLevelDirect(cell, maxAllowed)
      }
    }
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
        const nearRelief =
          cell.z !== 0 ||
          [-1, 0, 1].some(di =>
            [-1, 0, 1].some(dj => (di !== 0 || dj !== 0) && (this.map.grid[i + di]?.[j + dj]?.z || 0) !== 0)
          )
        if (!nearRelief) continue

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

        addBackfillSprite(0)

        // At the map perimeter there is no neighboring tile behind a relief
        // sprite. Stack hidden base diamonds through its height to close that edge.
        const isMapEdge = i === 0 || j === 0 || i === this.map.size || j === this.map.size
        if (isMapEdge && cell.z !== 0) {
          const direction = Math.sign(cell.z)
          for (let level = direction; level !== cell.z + direction; level += direction) {
            addBackfillSprite(level)
          }
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

  enforceReliefStepContinuity(dist = this.map.getReliefCoastDistances(), protectedCells = new Set()) {
    const n = this.map.size + 1
    const diagonalDirections = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ]
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
          if (
            cell.category === 'Water' ||
            cell.waterBorder ||
            cell.has ||
            protectedCells.has(cell) ||
            cell.z <= level
          )
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

            const lowMaxAllowed = this.map.getMaxReliefLevelFromCoastDistance(dist[low.i * n + low.j])
            const lowMinAllowed = this.map.getMinReliefLevelFromCoastDistance(dist[low.i * n + low.j])
            const highMaxAllowed = this.map.getMaxReliefLevelFromCoastDistance(dist[high.i * n + high.j])
            const highMinAllowed = this.map.getMinReliefLevelFromCoastDistance(dist[high.i * n + high.j])
            const targetLowLevel = high.z - 1
            const targetHighLevel = Math.max(highMinAllowed, Math.min(highMaxAllowed, low.z + 1))
            const lowDepressionLimit = depressionUpperBounds[low.i * n + low.j]
            const boundedTargetLowLevel = Math.min(targetLowLevel, lowDepressionLimit)
            const highProtected = protectedCells.has(high)
            const lowProtected = protectedCells.has(low)

            if (highProtected && lowProtected) continue

            if (lowProtected) {
              this.map.setCellReliefLevelDirect(high, targetHighLevel)
            } else {
              const target = highProtected ? targetLowLevel : boundedTargetLowLevel
              if (!low.has && target > low.z && target >= lowMinAllowed && target <= lowMaxAllowed) {
                this.map.setCellReliefLevelDirect(low, target)
              } else if (!highProtected) {
                this.map.setCellReliefLevelDirect(high, targetHighLevel)
              } else {
                continue
              }
            }
            changed = true
          }
        }
      }

      return changed
    }

    const getHigherNeighbors = cell => {
      const { i, j, z } = cell
      const isHigher = neighbor => Boolean(neighbor && neighbor.z > z)

      return {
        n: isHigher(this.map.grid[i - 1]?.[j]),
        ne: isHigher(this.map.grid[i - 1]?.[j + 1]),
        e: isHigher(this.map.grid[i]?.[j + 1]),
        se: isHigher(this.map.grid[i + 1]?.[j + 1]),
        s: isHigher(this.map.grid[i + 1]?.[j]),
        sw: isHigher(this.map.grid[i + 1]?.[j - 1]),
        w: isHigher(this.map.grid[i]?.[j - 1]),
        nw: isHigher(this.map.grid[i - 1]?.[j - 1]),
      }
    }

    const raiseUnsupportedTransitions = isUnsupported => {
      const adjustments = []

      for (let i = 0; i <= this.map.size; i++) {
        for (let j = 0; j <= this.map.size; j++) {
          const cell = this.map.grid[i][j]
          if (cell.category === 'Water' || cell.waterBorder || protectedCells.has(cell)) continue

          const higher = getHigherNeighbors(cell)
          if (!isUnsupported(higher)) continue

          const higherLevels = [
            this.map.grid[i - 1]?.[j],
            this.map.grid[i - 1]?.[j + 1],
            this.map.grid[i]?.[j + 1],
            this.map.grid[i + 1]?.[j + 1],
            this.map.grid[i + 1]?.[j],
            this.map.grid[i + 1]?.[j - 1],
            this.map.grid[i]?.[j - 1],
            this.map.grid[i - 1]?.[j - 1],
          ]
            .filter(neighbor => neighbor && neighbor.z > cell.z)
            .map(neighbor => neighbor.z)

          if (!higherLevels.length) continue
          const maxAllowed = this.map.getMaxReliefLevelFromCoastDistance(dist[i * n + j])
          const depressionLimit = depressionUpperBounds[i * n + j]
          const targetLevel = Math.min(Math.min(...higherLevels), maxAllowed, depressionLimit)
          if (targetLevel > cell.z) adjustments.push([cell, targetLevel])
        }
      }

      for (const [cell, targetLevel] of adjustments) {
        this.map.setCellReliefLevelDirect(cell, targetLevel)
      }

      return adjustments.length > 0
    }

    const hasOppositeHighSides = ({ n, e, s, w }) => (n && s) || (e && w)
    const hasDisconnectedHighNeighbors = ({ n, ne, e, se, s, sw, w, nw }) => {
      const cardinalCount = Number(n) + Number(e) + Number(s) + Number(w)
      const diagonalCount = Number(ne) + Number(se) + Number(sw) + Number(nw)

      if (cardinalCount === 0) return diagonalCount > 1
      if (cardinalCount !== 1) return false
      if (n) return sw || se
      if (e) return nw || sw
      if (s) return nw || ne
      return ne || se
    }

    // Height and sprite-mask corrections can expose new problems for each other.
    // Converge both systems now instead of waiting for another editor refresh.
    let changed = true
    let guard = 0
    const maxPasses = Math.max(1, this.map.size * 2)
    while (changed && guard++ < maxPasses) {
      changed = enforceHeightSteps()
      // The atlas has no valid tile for a low cell squeezed between opposite high sides.
      changed = raiseUnsupportedTransitions(hasOppositeHighSides) || changed
      // A single high side can only connect to the two diagonals touching that side.
      changed = raiseUnsupportedTransitions(hasDisconnectedHighNeighbors) || changed
    }
  }

  formatCellsRelief() {
    // Relief sprites contain transparent cut-outs. Keep flat terrain underneath so
    // unsupported concave combinations never reveal the black scene background.
    this.rebuildTerrainBackfill()

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        const nz = this.map.grid[i - 1]?.[j]?.z ?? cell.z
        const sz = this.map.grid[i + 1]?.[j]?.z ?? cell.z
        const wz = this.map.grid[i]?.[j - 1]?.z ?? cell.z
        const ez = this.map.grid[i]?.[j + 1]?.z ?? cell.z

        if ((cell.category === 'Water' || cell.waterBorder) && (nz > cell.z || sz > cell.z || wz > cell.z || ez > cell.z)) {
          console.log(`[relief] SKIPPED waterBorder at [${i},${j}] z=${cell.z} N=${nz} S=${sz} W=${wz} E=${ez}`)
        }
        if (cell.category === 'Water' || cell.waterBorder) continue

        const nwz = this.map.grid[i - 1]?.[j - 1]?.z ?? cell.z
        const nez = this.map.grid[i - 1]?.[j + 1]?.z ?? cell.z
        const swz = this.map.grid[i + 1]?.[j - 1]?.z ?? cell.z
        const sez = this.map.grid[i + 1]?.[j + 1]?.z ?? cell.z

        const n = nz > cell.z
        const s = sz > cell.z
        const w = wz > cell.z
        const e = ez > cell.z
        const nw = nwz > cell.z
        const ne = nez > cell.z
        const sw = swz > cell.z
        const se = sez > cell.z

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
          console.log(`[relief] UNHANDLED diagonal at [${i},${j}] z=${cell.z} NW=${nwz} NE=${nez} SW=${swz} SE=${sez}`)
        }
      }
    }

  }

  formatCellsWaterBorder() {
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell.type === 'Water') continue

        const n = this.map.grid[i - 1]?.[j]?.type === 'Water'
        const s = this.map.grid[i + 1]?.[j]?.type === 'Water'
        const w = this.map.grid[i]?.[j - 1]?.type === 'Water'
        const e = this.map.grid[i]?.[j + 1]?.type === 'Water'
        const nw = this.map.grid[i - 1]?.[j - 1]?.type === 'Water'
        const sw = this.map.grid[i + 1]?.[j - 1]?.type === 'Water'
        const ne = this.map.grid[i - 1]?.[j + 1]?.type === 'Water'
        const se = this.map.grid[i + 1]?.[j + 1]?.type === 'Water'
        if (w && n) cell.setWaterBorder('20000', '001')
        else if (e && s) cell.setWaterBorder('20000', '002')
        else if (w && s) cell.setWaterBorder('20000', '003')
        else if (e && n) cell.setWaterBorder('20000', '000')
        else if (n) cell.setWaterBorder('20000', '008')
        else if (s) cell.setWaterBorder('20000', '009')
        else if (w) cell.setWaterBorder('20000', '011')
        else if (e) cell.setWaterBorder('20000', '010')
        else if (nw) cell.setWaterBorder('20000', '005')
        else if (sw) cell.setWaterBorder('20000', '007')
        else if (ne) cell.setWaterBorder('20000', '004')
        else if (se) cell.setWaterBorder('20000', '006')
      }
    }
  }

  formatCellsWaterBorderOverlays() {
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (!cell.waterBorder) continue

        const overlay = (neighbor, direction) => {
          if (neighbor && !neighbor.waterBorder && neighbor.type !== 'Water' && neighbor.type !== 'Desert') {
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
