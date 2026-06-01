import { Assets, Sprite } from 'pixi.js'
import { randomRange, instancesDistance, getCellsAroundPoint, getInstanceZIndex, formatNumber } from '../../lib'
import { CELL_DEPTH, LABEL_TYPES } from '../../constants'

// Lookup table for setDesertBorder — indexed by cell sprite index, returns 4 border variants (W/N/S/E)
const _DESERT_VAL = Array.from({ length: 25 }, (_, i) =>
  i < 9 ? [0, 1, 2, 3] : Array.from({ length: 4 }, (__, k) => (i - 9) * 4 + k + 4)
)

export class CellTerrain {
  constructor(cell) {
    this.cell = cell
  }

  setDesertBorder(direction) {
    const { cell } = this
    const alreadySet = cell.children.some(c => c.type === 'border' && c.direction === direction)
    if (alreadySet) return
    const resourceName = '20002'
    const cellSpriteTextureName = cell.sprite.texture.label
    const cellSpriteIndex = +cellSpriteTextureName.split('_')[0]
    const dirIndex = { west: 0, north: 1, south: 2, east: 3 }[direction]
    const index = _DESERT_VAL[cellSpriteIndex][dirIndex]
    const spritesheet = Assets.cache.get(resourceName)
    const texture = spritesheet.textures[formatNumber(index) + '_' + resourceName + '.png']
    const sprite = new Sprite(texture)
    sprite.direction = direction
    sprite.anchor.set(0.5, 0.5)
    sprite.type = 'border'
    cell.addChild(sprite)
  }

  setWaterBorder(resourceName, index) {
    const { cell } = this
    const { sprite } = cell
    const spritesheet = Assets.cache.get(resourceName)
    const texture = spritesheet.textures[index + '_' + resourceName + '.png']
    cell.border = true
    cell.waterBorder = true
    if (cell.has && typeof cell.has.die === 'function') {
      cell.has.die(true)
    }
    sprite.texture = texture
  }

  setReliefBorder(index, elevation = 0) {
    const { cell } = this
    const { sprite } = cell
    const resourceName = sprite.texture.label.split('_')[1].split('.')[0]
    const spritesheet = Assets.cache.get(resourceName)
    const texture = spritesheet.textures[index + '_' + resourceName + '.png']
    if (elevation) {
      cell.y -= elevation
    }
    cell.inclined = true
    if (cell.has) {
      cell.has.zIndex = getInstanceZIndex(cell.has)
    }
    sprite.label = LABEL_TYPES.sprite
    sprite.anchor.set(0.5, 0.5)
    sprite.texture = texture
  }

  setWater() {
    const { cell } = this
    const index = formatNumber(randomRange(0, 3))
    const resourceName = '15002'
    const spritesheet = Assets.cache.get(resourceName)
    cell.sprite.texture = spritesheet.textures[index + '_' + resourceName + '.png']
    cell.type = 'Water'
    cell.category = 'Water'
  }

  fillWaterCellsAroundCell() {
    const { cell } = this
    const grid = cell.parent.grid
    if (cell.type === 'Water' && !cell.sprite.texture.label.includes('15002')) {
      this.setWater()
    }
    getCellsAroundPoint(cell.i, cell.j, grid, 2, neighbor => {
      if (neighbor.type === 'Water' && cell.type === 'Water') {
        const dist = instancesDistance(cell, neighbor)
        const velX = Math.round((cell.i - neighbor.i) / dist)
        const velY = Math.round((cell.j - neighbor.j) / dist)
        if (grid[neighbor.i + velX] && grid[neighbor.i + velX][neighbor.j + velY]) {
          const target = grid[neighbor.i + velX][neighbor.j + velY]
          const aside = grid[cell.i + neighbor.i - target.i][cell.j + neighbor.j - target.j]
          if (target.type !== cell.type && aside.type !== cell.type) {
            if (Math.floor(dist) === 2) {
              neighbor.setWater()
              target.setWater()
            }
          }
        }
      }
    })
  }

  fillReliefCellsAroundCell() {
    const { cell } = this
    const grid = cell.parent.grid
    getCellsAroundPoint(cell.i, cell.j, grid, 2, neighbor => {
      if (neighbor.z === cell.z) {
        const dist = instancesDistance(cell, neighbor)
        const velX = Math.round((cell.i - neighbor.i) / dist)
        const velY = Math.round((cell.j - neighbor.j) / dist)
        if (grid[neighbor.i + velX] && grid[neighbor.i + velX][neighbor.j + velY]) {
          const target = grid[neighbor.i + velX][neighbor.j + velY]
          const aside = grid[cell.i + neighbor.i - target.i][cell.j + neighbor.j - target.j]
          if (
            target.category !== 'Water' &&
            !target.waterBorder &&
            target.z <= cell.z &&
            target.z !== cell.z &&
            aside.z !== cell.z
          ) {
            if (Math.floor(dist) === 2) {
              target.setCellLevel(target.z + 1)
            }
          }
        }
      }
    })
  }

  setCellLevel(level, cpt = 1) {
    const { cell } = this
    if (level === 0) {
      cell.y += CELL_DEPTH
      cell.z = level
      return
    }
    const grid = cell.parent.grid
    getCellsAroundPoint(cell.i, cell.j, grid, level - cpt, neighbor => {
      if (neighbor.z < cpt) {
        neighbor.y -= (cpt - neighbor.z) * CELL_DEPTH
        neighbor.z = cpt
        neighbor.fillReliefCellsAroundCell()
      }
    })
    if (cpt + 1 < level) {
      cell.setCellLevel(level, cpt + 1)
    }
    if (cell.has) {
      cell.has.zIndex = getInstanceZIndex(cell.has)
    }
  }
}
