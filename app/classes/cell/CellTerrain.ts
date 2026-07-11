import type { Container, ContainerChild, Texture } from 'pixi.js'
import { Assets, Sprite } from 'pixi.js'
import {
  instancesDistance,
  getCellsAroundPoint,
  getInstanceZIndex,
  formatNumber,
  cartesianToIsometric,
  getDeterministicCellVariant,
} from '../../lib'
import { CELL_DEPTH, CELL_WIDTH, LABEL_TYPES } from '../../constants'
import type { RuntimeEntity } from '../../types/entities'

type ZIndexedPoint = { x: number; y: number; z?: number | null }

type Direction = 'west' | 'north' | 'south' | 'east'
type BorderVariantMap = Record<number, number[]>
type TerrainDefinition = {
  category?: string
  color?: string | number
  assets?: string[]
  [key: string]: string | string[] | number | boolean | undefined
}

type TerrainConfig = {
  cells?: Record<string, TerrainDefinition>
}

type TerrainSprite = Sprite & {
  direction?: Direction
  type?: string
}
type TerrainChild = ContainerChild & {
  direction?: Direction
  type?: string
}

export type TerrainMapLike = {
  seed?: string | number
  size: number
  grid: TerrainCellLike[][]
  randomRange(min: number, max: number): number
}

export type TerrainParentLike = {
  size?: number
  grid?: TerrainCellLike[][]
  randomRange?(min: number, max: number): number
  invalidateReliefCoastDistances?: () => void
}

type TerrainContextMapLike = {
  randomRange(min: number, max: number): number
}

type TerrainVariantMapLike = {
  seed?: string | number
}

export type TerrainCellLike = {
  context: { map: TerrainContextMapLike }
  parent?: Container | TerrainParentLike | null
  map?: TerrainVariantMapLike
  i: number
  j: number
  x: number
  y: number
  z: number
  type: string
  category?: string
  color?: string | number
  assets?: string[]
  terrainTextureName?: string
  children: TerrainChild[]
  sprite: TerrainSprite | null
  has: RuntimeEntity | null
  inclined: boolean
  border: boolean
  waterBorder: boolean
  addChild(child: TerrainSprite): TerrainSprite
  removeChild(child: TerrainChild): TerrainChild
  setCellLevel(level: number, cpt?: number): void
  fillReliefCellsAroundCell(): void
}

function asTerrainParent(parent: Container | TerrainParentLike | null | undefined): TerrainParentLike | null {
  if (!parent) return null
  if ('grid' in parent || 'invalidateReliefCoastDistances' in parent) return parent
  return null
}

// Border 20002 exposes dedicated slope variants. Some relief tiles intentionally reuse the same
// silhouette (009/017, 010/018, 011/019, 012/020) but still have duplicated border frames in the atlas.
const DESERT_BORDER_VARIANTS_BY_TILE_INDEX: BorderVariantMap = {
  0: [0, 1, 2, 3],
  1: [0, 1, 2, 3],
  2: [0, 1, 2, 3],
  3: [0, 1, 2, 3],
  4: [0, 1, 2, 3],
  5: [0, 1, 2, 3],
  6: [0, 1, 2, 3],
  7: [0, 1, 2, 3],
  8: [0, 1, 2, 3],
  9: [4, 5, 6, 7],
  10: [8, 9, 10, 11],
  11: [12, 13, 14, 15],
  12: [16, 17, 18, 19],
  13: [20, 21, 22, 23],
  14: [24, 25, 26, 27],
  15: [28, 29, 30, 31],
  16: [32, 33, 34, 35],
  17: [36, 37, 38, 39],
  18: [40, 41, 42, 43],
  19: [44, 45, 46, 47],
  20: [48, 49, 50, 51],
  21: [52, 53, 54, 55],
  22: [56, 57, 58, 59],
  23: [60, 61, 62, 63],
  24: [64, 65, 66, 67],
}

function getDesertBorderVariants(cellSpriteIndex: number): number[] {
  return DESERT_BORDER_VARIANTS_BY_TILE_INDEX[cellSpriteIndex] ?? DESERT_BORDER_VARIANTS_BY_TILE_INDEX[0]
}

// Border 20006 mirrors 20002 exactly: same 68-frame layout, same tile-index-to-frame mapping.
const DEEP_WATER_BORDER_VARIANTS_BY_TILE_INDEX: BorderVariantMap = {
  0: [0, 1, 2, 3],
  1: [0, 1, 2, 3],
  2: [0, 1, 2, 3],
  3: [0, 1, 2, 3],
  4: [0, 1, 2, 3],
  5: [0, 1, 2, 3],
  6: [0, 1, 2, 3],
  7: [0, 1, 2, 3],
  8: [0, 1, 2, 3],
  9: [4, 5, 6, 7],
  10: [8, 9, 10, 11],
  11: [12, 13, 14, 15],
  12: [16, 17, 18, 19],
  13: [20, 21, 22, 23],
  14: [24, 25, 26, 27],
  15: [28, 29, 30, 31],
  16: [32, 33, 34, 35],
  17: [36, 37, 38, 39],
  18: [40, 41, 42, 43],
  19: [44, 45, 46, 47],
  20: [48, 49, 50, 51],
  21: [52, 53, 54, 55],
  22: [56, 57, 58, 59],
  23: [60, 61, 62, 63],
  24: [64, 65, 66, 67],
}

function getDeepWaterBorderVariants(cellSpriteIndex: number): number[] {
  return DEEP_WATER_BORDER_VARIANTS_BY_TILE_INDEX[cellSpriteIndex] ?? DEEP_WATER_BORDER_VARIANTS_BY_TILE_INDEX[0]
}

export class CellTerrain {
  cell: TerrainCellLike

  constructor(cell: TerrainCellLike) {
    this.cell = cell
  }

  _getBaseTexture(type: string = this.cell.type): Texture | null {
    const config = Assets.cache.get('config') as TerrainConfig
    const definition = config?.cells?.[type]
    const assets = definition?.assets || []
    if (!assets.length) return null
    const textureName = getDeterministicCellVariant(assets, this.cell.i, this.cell.j, this.cell.map?.seed)
    if (!textureName) return null
    const resourceName = textureName.split('_')[1]
    const spritesheet = Assets.cache.get(resourceName)
    return spritesheet?.textures?.[textureName + '.png'] || null
  }

  resetTerrainAppearance(): void {
    const { cell } = this
    if (!cell.sprite) return
    const [x, y] = cartesianToIsometric(cell.i, cell.j)

    for (let index = cell.children.length - 1; index >= 0; index--) {
      const child = cell.children[index]
      const isTerrainDecoration = child.label === LABEL_TYPES.floor || child.label === LABEL_TYPES.set
      if (child !== cell.sprite && !isTerrainDecoration) {
        cell.removeChild(child)
        child.destroy?.()
      }
    }

    const texture = this._getBaseTexture()
    if (texture) {
      cell.sprite.texture = texture
      cell.sprite.anchor.set(
        Math.floor(texture.width / 2) / texture.width,
        Math.floor(texture.height / 2) / texture.height
      )
    }

    cell.x = x
    cell.y = y - cell.z * CELL_DEPTH
    cell.inclined = false
    cell.border = false
    cell.waterBorder = false
  }

  setTerrainType(type: string): void {
    const { cell } = this
    const config = Assets.cache.get('config') as TerrainConfig
    const definition = config?.cells?.[type]
    if (!definition) return

    const previousType = cell.type
    cell.type = type
    Object.assign(cell, definition)
    if ((previousType === 'Water' || previousType === 'DeepWater') !== (type === 'Water' || type === 'DeepWater')) {
      asTerrainParent(cell.parent)?.invalidateReliefCoastDistances?.()
    }
    this.resetTerrainAppearance()
  }

  setDesertBorder(direction: string): void {
    const { cell } = this
    if (!cell.sprite) return
    const alreadySet = cell.children.some(c => c.type === 'border' && c.direction === direction)
    if (alreadySet) return
    const resourceName = '20002'
    const cellSpriteTextureName = cell.sprite.texture.label
    if (!cellSpriteTextureName) return
    const cellSpriteIndex = +cellSpriteTextureName.split('_')[0]
    const dirIndex = ({ west: 0, north: 1, south: 2, east: 3 } satisfies Record<Direction, number>)[
      direction as Direction
    ]
    const variants = getDesertBorderVariants(cellSpriteIndex)
    const index = variants[dirIndex]
    if (index == null) return
    const spritesheet = Assets.cache.get(resourceName)
    const textureName = formatNumber(index) + '_' + resourceName + '.png'
    const texture = spritesheet?.textures?.[textureName]
    if (!texture) {
      console.log(
        `[desert-border] Missing texture "${textureName}" for tile ${cellSpriteTextureName} at [${cell.i},${cell.j}]`
      )
      return
    }
    const sprite = new Sprite(texture) as TerrainSprite
    sprite.direction = direction as Direction
    sprite.anchor.set(Math.floor(texture.width / 2) / texture.width, Math.floor(texture.height / 2) / texture.height)
    sprite.type = 'border'
    sprite.zIndex = 10
    cell.addChild(sprite)
  }

  setDeepWaterBorder(direction: string): void {
    const { cell } = this
    if (!cell.sprite) return
    const alreadySet = cell.children.some(c => c.type === 'deepWaterBorder' && c.direction === direction)
    if (alreadySet) return
    const resourceName = '20006'
    const cellSpriteTextureName = cell.sprite.texture.label
    if (!cellSpriteTextureName) return
    const cellSpriteIndex = +cellSpriteTextureName.split('_')[0]
    const dirIndex = ({ west: 0, north: 1, south: 2, east: 3 } satisfies Record<Direction, number>)[
      direction as Direction
    ]
    const variants = getDeepWaterBorderVariants(cellSpriteIndex)
    const index = variants[dirIndex]
    if (index == null) return
    const spritesheet = Assets.cache.get(resourceName)
    const textureName = formatNumber(index) + '_' + resourceName + '.png'
    const texture = spritesheet?.textures?.[textureName]
    if (!texture) return
    const sprite = new Sprite(texture) as TerrainSprite
    sprite.direction = direction as Direction
    sprite.anchor.set(Math.floor(texture.width / 2) / texture.width, Math.floor(texture.height / 2) / texture.height)
    sprite.type = 'deepWaterBorder'
    sprite.zIndex = 10
    cell.addChild(sprite)
  }

  setWaterBorder(resourceName: string, index: number): void {
    const { cell } = this
    const { sprite } = cell
    if (!sprite) return
    const spritesheet = Assets.cache.get(resourceName)
    const texture = spritesheet.textures[index + '_' + resourceName + '.png']
    cell.border = true
    cell.waterBorder = true
    if (cell.has && typeof cell.has.die === 'function') {
      cell.has.die()
    }
    sprite.texture = texture
  }

  setReliefBorder(index: number, elevation: number = 0): void {
    const { cell } = this
    const { sprite } = cell
    if (!sprite) return
    const baseTexture = sprite.texture
    const label = sprite.texture.label
    if (!label || !label.includes('_')) {
      console.log(`[relief] BAD LABEL at [${cell.i},${cell.j}]: "${label}"`)
      return
    }
    const resourceName = label.split('_')[1].split('.')[0]
    const spritesheet = Assets.cache.get(resourceName)
    if (!spritesheet) {
      console.log(`[relief] NO SPRITESHEET "${resourceName}" at [${cell.i},${cell.j}]`)
      return
    }
    const texture = spritesheet.textures[index + '_' + resourceName + '.png']
    if (!texture) {
      console.log(`[relief] MISSING TEXTURE "${index}_${resourceName}.png" at [${cell.i},${cell.j}]`)
      return
    }

    // Relief frames are intentionally transparent. Keep the original flat tile
    // inside the cell so fog baking and container sorting can never expose the scene.
    const underlay = new Sprite(baseTexture) as TerrainSprite
    underlay.type = 'reliefUnderlay'
    underlay.y = elevation
    underlay.zIndex = -1
    underlay.roundPixels = true
    underlay.eventMode = 'none'
    underlay.anchor.set(
      Math.floor(baseTexture.width / 2) / baseTexture.width,
      Math.floor(baseTexture.height / 2) / baseTexture.height
    )
    cell.addChild(underlay)

    if (elevation) {
      cell.y -= elevation
    }
    cell.inclined = true
    if (cell.has) {
      cell.has.zIndex = getInstanceZIndex(cell.has as ZIndexedPoint)
    }
    sprite.label = LABEL_TYPES.sprite
    sprite.texture = texture
    sprite.anchor.set(CELL_WIDTH / 2 / texture.width, Math.floor(texture.height / 2) / texture.height)
  }

  setWater(): void {
    const { cell } = this
    if (!cell.sprite) return
    const index = formatNumber(cell.context.map.randomRange(0, 3))
    const resourceName = '15002'
    const spritesheet = Assets.cache.get(resourceName)
    cell.sprite.texture = spritesheet.textures[index + '_' + resourceName + '.png']
    cell.type = 'Water'
    cell.category = 'Water'
    asTerrainParent(cell.parent)?.invalidateReliefCoastDistances?.()
  }

  fillReliefCellsAroundCell(): void {
    const { cell } = this
    const grid = asTerrainParent(cell.parent)?.grid
    if (!grid) return
    getCellsAroundPoint(cell.i, cell.j, grid, 2, (neighbor: TerrainCellLike) => {
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
      return false
    })
  }

  setCellLevel(level: number, cpt: number = 1): void {
    const { cell } = this
    if (level === 0) {
      cell.z = level
      cell.y += CELL_DEPTH
      return
    }
    const grid = asTerrainParent(cell.parent)?.grid
    if (!grid) return
    getCellsAroundPoint(cell.i, cell.j, grid, level - cpt, (neighbor: TerrainCellLike) => {
      if (neighbor.z < cpt && !neighbor.has) {
        neighbor.y -= (cpt - neighbor.z) * CELL_DEPTH
        neighbor.z = cpt
        neighbor.fillReliefCellsAroundCell()
      }
      return false
    })
    if (cpt + 1 < level) {
      cell.setCellLevel(level, cpt + 1)
    }
    if (cell.has) {
      cell.has.zIndex = getInstanceZIndex(cell.has as ZIndexedPoint)
    }
  }
}
