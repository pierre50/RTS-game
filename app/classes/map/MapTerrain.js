import { getCellsAroundPoint, getPlainCellsAroundPoint } from '../../lib'
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
      const xi = Math.floor(x), yi = Math.floor(y)
      const xf = x - xi, yf = y - yi
      const s = t => t * t * (3 - 2 * t)
      const u = s(xf), v = s(yf)
      const a = hash(xi, yi), b = hash(xi + 1, yi)
      const c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
      return a + (b - a) * u + (c - a) * v + (d + a - b - c) * u * v
    }
    function fbm(x, y) {
      let val = 0, amp = 0.5, freq = 1, sum = 0
      for (let o = 0; o < 4; o++) {
        val += noise(x * freq, y * freq) * amp
        sum += amp; amp *= 0.5; freq *= 2
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
    for (let targetLevel = 3; targetLevel >= 1; targetLevel--) {
      const threshold = levelThresholds[targetLevel]
      for (let i = 0; i <= this.map.size; i++) {
        for (let j = 0; j <= this.map.size; j++) {
          const cell = this.map.grid[i][j]
          if (cell.category === 'Water' || cell.has || cell.waterBorder || this.map.isInPlayerStartFlatZone(i, j)) continue
          const maxAllowed = this.map.getMaxReliefLevelFromCoastDistance(dist[i * n + j])
          const actual = Math.min(targetLevel, maxAllowed)
          if (reliefH[i * n + j] > threshold && actual > cell.z) {
            cell.setCellLevel(actual)
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
          getCellsAroundPoint(i, j, this.map.grid, 1, c => { if (c.z > 0) cpt++ })
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
  }

  isInPlayerStartFlatZone(i, j, radius = 4) {
    return this.map.playersPos.some(pos => Math.abs(pos.i - i) <= radius && Math.abs(pos.j - j) <= radius)
  }

  flattenPlayerStartZones(radius = 4) {
    for (const pos of this.map.playersPos) {
      const cells = getPlainCellsAroundPoint(pos.i, pos.j, this.map.grid, radius)
      for (const cell of cells) {
        if (cell.category !== 'Water' && !cell.waterBorder && cell.z !== 0) {
          this.map.setCellReliefLevelDirect(cell, 0)
        }
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
      const ci = Math.floor(idx / n), cj = idx % n
      const d = dist[idx]
      for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const ni = ci + di, nj = cj + dj
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

  setCellReliefLevelDirect(cell, level) {
    const delta = level - cell.z
    if (delta === 0) return
    cell.y -= delta * CELL_DEPTH
    cell.z = level
  }

  clampReliefAroundWater(dist = this.map.getReliefCoastDistances()) {
    const n = this.map.size + 1
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        const maxAllowed = this.map.getMaxReliefLevelFromCoastDistance(dist[i * n + j])
        if (cell.z > maxAllowed) this.map.setCellReliefLevelDirect(cell, maxAllowed)
      }
    }
  }

  formatCellsRelief() {
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        const _n = this.map.grid[i - 1]?.[j]?.z ?? cell.z
        const _s = this.map.grid[i + 1]?.[j]?.z ?? cell.z
        const _w = this.map.grid[i]?.[j - 1]?.z ?? cell.z
        const _e = this.map.grid[i]?.[j + 1]?.z ?? cell.z
        if ((cell.category === 'Water' || cell.waterBorder) && (_n > cell.z || _s > cell.z || _w > cell.z || _e > cell.z)) {
          console.log(`[relief] SKIPPED waterBorder at [${i},${j}] z=${cell.z} N=${_n} S=${_s} W=${_w} E=${_e}`)
        }
        if (cell.category === 'Water' || cell.waterBorder) continue
        if (
          this.map.grid[i - 1] &&
          this.map.grid[i - 1][j].z - cell.z >= 1 &&
          (!this.map.grid[i + 1] || this.map.grid[i + 1][j].z <= cell.z) &&
          (!this.map.grid[i][j - 1] || this.map.grid[i][j - 1].z <= cell.z) &&
          (!this.map.grid[i][j + 1] || this.map.grid[i][j + 1].z <= cell.z)
        ) {
          cell.setReliefBorder('014', CELL_DEPTH / 2)
        } else if (
          this.map.grid[i + 1] &&
          this.map.grid[i + 1][j].z - cell.z >= 1 &&
          (!this.map.grid[i - 1] || this.map.grid[i - 1][j].z <= cell.z) &&
          (!this.map.grid[i][j - 1] || this.map.grid[i][j - 1].z <= cell.z) &&
          (!this.map.grid[i][j + 1] || this.map.grid[i][j + 1].z <= cell.z)
        ) {
          cell.setReliefBorder('015', CELL_DEPTH / 2)
        } else if (
          this.map.grid[i][j - 1] &&
          this.map.grid[i][j - 1].z - cell.z >= 1 &&
          (!this.map.grid[i + 1] || this.map.grid[i + 1][j].z <= cell.z) &&
          (!this.map.grid[i][j + 1] || this.map.grid[i][j + 1].z <= cell.z) &&
          (!this.map.grid[i - 1] || this.map.grid[i - 1][j].z <= cell.z)
        ) {
          cell.setReliefBorder('016', CELL_DEPTH / 2)
        } else if (
          this.map.grid[i][j + 1] &&
          this.map.grid[i][j + 1].z - cell.z >= 1 &&
          (!this.map.grid[i + 1] || this.map.grid[i + 1][j].z <= cell.z) &&
          (!this.map.grid[i][j - 1] || this.map.grid[i][j - 1].z <= cell.z) &&
          (!this.map.grid[i - 1] || this.map.grid[i - 1][j].z <= cell.z)
        ) {
          cell.setReliefBorder('013', CELL_DEPTH / 2)
        } else if (
          this.map.grid[i - 1] &&
          this.map.grid[i - 1][j - 1] &&
          this.map.grid[i - 1][j - 1].z - cell.z >= 1 &&
          (!this.map.grid[i][j - 1] || this.map.grid[i][j - 1].z <= cell.z) &&
          (!this.map.grid[i - 1] || this.map.grid[i - 1][j].z <= cell.z)
        ) {
          cell.setReliefBorder('010', CELL_DEPTH / 2)
        } else if (
          this.map.grid[i + 1] &&
          this.map.grid[i + 1][j - 1] &&
          this.map.grid[i + 1][j - 1].z - cell.z >= 1 &&
          (!this.map.grid[i][j - 1] || this.map.grid[i][j - 1].z <= cell.z) &&
          (!this.map.grid[i + 1] || this.map.grid[i + 1][j].z <= cell.z)
        ) {
          cell.setReliefBorder('012')
        } else if (
          this.map.grid[i - 1] &&
          this.map.grid[i - 1][j + 1] &&
          this.map.grid[i - 1][j + 1].z - cell.z >= 1 &&
          (!this.map.grid[i][j + 1] || this.map.grid[i][j + 1].z <= cell.z) &&
          (!this.map.grid[i - 1] || this.map.grid[i - 1][j].z <= cell.z)
        ) {
          cell.setReliefBorder('011')
        } else if (
          this.map.grid[i + 1] &&
          this.map.grid[i + 1][j + 1] &&
          this.map.grid[i + 1][j + 1].z - cell.z >= 1 &&
          (!this.map.grid[i][j + 1] || this.map.grid[i][j + 1].z <= cell.z) &&
          (!this.map.grid[i + 1] || this.map.grid[i + 1][j].z <= cell.z)
        ) {
          cell.setReliefBorder('009', CELL_DEPTH / 2)
        } else if (
          this.map.grid[i][j - 1] &&
          this.map.grid[i][j - 1].z - cell.z >= 1 &&
          this.map.grid[i - 1] &&
          this.map.grid[i - 1][j].z - cell.z >= 1
        ) {
          cell.setReliefBorder('022', CELL_DEPTH / 2)
        } else if (
          this.map.grid[i][j + 1] &&
          this.map.grid[i][j + 1].z - cell.z >= 1 &&
          this.map.grid[i + 1] &&
          this.map.grid[i + 1][j].z - cell.z >= 1
        ) {
          cell.setReliefBorder('021', CELL_DEPTH / 2)
        } else if (
          this.map.grid[i][j - 1] &&
          this.map.grid[i][j - 1].z - cell.z >= 1 &&
          this.map.grid[i + 1] &&
          this.map.grid[i + 1][j].z - cell.z >= 1
        ) {
          cell.setReliefBorder('023', CELL_DEPTH)
        } else if (
          this.map.grid[i][j + 1] &&
          this.map.grid[i][j + 1].z - cell.z >= 1 &&
          this.map.grid[i - 1] &&
          this.map.grid[i - 1][j].z - cell.z >= 1
        ) {
          cell.setReliefBorder('024', CELL_DEPTH)
        } else if (
          this.map.grid[i - 1] &&
          this.map.grid[i - 1][j].z - cell.z >= 1 &&
          this.map.grid[i + 1] &&
          this.map.grid[i + 1][j].z - cell.z >= 1
        ) {
          cell.setReliefBorder('017', CELL_DEPTH / 2)
        } else if (
          this.map.grid[i][j - 1] &&
          this.map.grid[i][j - 1].z - cell.z >= 1 &&
          this.map.grid[i][j + 1] &&
          this.map.grid[i][j + 1].z - cell.z >= 1
        ) {
          cell.setReliefBorder('018', CELL_DEPTH / 2)
        } else {
          const _nw = this.map.grid[i - 1]?.[j - 1]?.z ?? cell.z
          const _ne = this.map.grid[i - 1]?.[j + 1]?.z ?? cell.z
          const _sw = this.map.grid[i + 1]?.[j - 1]?.z ?? cell.z
          const _se = this.map.grid[i + 1]?.[j + 1]?.z ?? cell.z
          if (_n > cell.z || _s > cell.z || _w > cell.z || _e > cell.z || _nw > cell.z || _ne > cell.z || _sw > cell.z || _se > cell.z) {
            console.log(`[relief] UNHANDLED at [${i},${j}] z=${cell.z} N=${_n} S=${_s} W=${_w} E=${_e} NW=${_nw} NE=${_ne} SW=${_sw} SE=${_se}`)
          }
        }
      }
    }
  }

  formatCellsWaterBorder() {
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell.type === 'Water') continue

        const n  = this.map.grid[i - 1]?.[j]?.type === 'Water'
        const s  = this.map.grid[i + 1]?.[j]?.type === 'Water'
        const w  = this.map.grid[i]?.[j - 1]?.type === 'Water'
        const e  = this.map.grid[i]?.[j + 1]?.type === 'Water'
        const nw = this.map.grid[i - 1]?.[j - 1]?.type === 'Water'
        const sw = this.map.grid[i + 1]?.[j - 1]?.type === 'Water'
        const ne = this.map.grid[i - 1]?.[j + 1]?.type === 'Water'
        const se = this.map.grid[i + 1]?.[j + 1]?.type === 'Water'

        if      (w && n) cell.setWaterBorder('20000', '001')
        else if (e && s) cell.setWaterBorder('20000', '002')
        else if (w && s) cell.setWaterBorder('20000', '003')
        else if (e && n) cell.setWaterBorder('20000', '000')
        else if (n)      cell.setWaterBorder('20000', '008')
        else if (s)      cell.setWaterBorder('20000', '009')
        else if (w)      cell.setWaterBorder('20000', '011')
        else if (e)      cell.setWaterBorder('20000', '010')
        else if (nw)     cell.setWaterBorder('20000', '005')
        else if (sw)     cell.setWaterBorder('20000', '007')
        else if (ne)     cell.setWaterBorder('20000', '004')
        else if (se)     cell.setWaterBorder('20000', '006')
      }
    }

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
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        const typeToFormat = ['Grass', 'Jungle']
        if (cell.type === 'Desert') {
          if (this.map.grid[i - 1] && this.map.grid[i - 1][j] && typeToFormat.includes(this.map.grid[i - 1][j].type)) {
            this.map.grid[i - 1][j].setDesertBorder('east')
          }
          if (this.map.grid[i + 1] && this.map.grid[i + 1][j] && typeToFormat.includes(this.map.grid[i + 1][j].type)) {
            this.map.grid[i + 1][j].setDesertBorder('west')
          }
          if (this.map.grid[i][j - 1] && typeToFormat.includes(this.map.grid[i][j - 1].type)) {
            this.map.grid[i][j - 1].setDesertBorder('south')
          }
          if (this.map.grid[i][j + 1] && typeToFormat.includes(this.map.grid[i][j + 1].type)) {
            this.map.grid[i][j + 1].setDesertBorder('north')
          }
        }
      }
    }
  }
}
