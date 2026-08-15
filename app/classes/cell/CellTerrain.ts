import { Assets, Sprite, Texture, type Container, type ContainerChild } from 'pixi.js'
import {
  instancesDistance,
  getCellsAroundPoint,
  getInstanceZIndex,
  formatNumber,
  cartesianToIsometric,
  getDeterministicCellVariant,
  getTexture,
  getTextureByFrame,
  parseTextureRef,
  textureRefToString,
} from '../../lib'
import { CELL_DEPTH, CELL_WIDTH, LABEL_TYPES } from '../../constants'
import type { RuntimeEntity } from '../../types/entities'
import type { TextureRef } from '../../lib'

type ZIndexedPoint = { x: number; y: number; z?: number | null }

type Direction = 'west' | 'north' | 'south' | 'east'
type BorderVariantMap = Record<number, number[]>

const BORDER_SHEETS = {
  desertRelief: 'desert-relief',
  dirtRelief: 'dirt-relief',
  snowRelief: 'snow-relief',
} as const

type PatchBorderGroundType = 'Desert' | 'Dirt' | 'Snow'

type TerrainDefinition = {
  category?: string
  color?: string | number
  assets?: TextureRef[]
  [key: string]: string | TextureRef[] | number | boolean | undefined
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

type TerrainContextLike = {
  map: TerrainContextMapLike
}

type TerrainContextMapLike = {
  randomRange(min: number, max: number): number
  registerWaterBorderSurface?: (
    sprite: { texture: Texture; destroyed?: boolean },
    frames: Texture[],
    initialFrame?: number
  ) => () => void
}

type TerrainVariantMapLike = {
  seed?: string | number
}

export type TerrainCellLike = {
  context: TerrainContextLike
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
  assets?: TextureRef[]
  terrainTextureName?: string
  _terrainAppearance?: {
    patchBorders?: Set<string> | null
    patchBorderGroundType?: PatchBorderGroundType | null
    relief?: { index: number; elevation: number } | null
    waterBorder?: { resourceName: string; index: number } | null
  }
  children: TerrainChild[]
  sprite: TerrainSprite | null
  has: RuntimeEntity | null
  inclined: boolean
  border: boolean
  waterBorder: boolean
  unregisterWaterBorderSurface?: (() => void) | null
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

// Shared by every relief-border sheet (desert, dirt, water — all 68-frame atlases with the
// same tile-index-to-frame layout, since dirt/water were built by copying desert's). Some
// relief tiles intentionally reuse the same silhouette (009/017, 010/018, 011/019, 012/020)
// but still have duplicated border frames in the atlas.
const RELIEF_BORDER_VARIANTS_BY_TILE_INDEX: BorderVariantMap = {
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

function getReliefBorderVariants(cellSpriteIndex: number): number[] {
  return RELIEF_BORDER_VARIANTS_BY_TILE_INDEX[cellSpriteIndex] ?? RELIEF_BORDER_VARIANTS_BY_TILE_INDEX[0]
}

const WATER_BORDER_BASE_FRAME_COUNT = 12
const WATER_BORDER_ANIMATION_PHASES = 4

function getWaterBorderAnimationFrames(resourceName: string, frameIndex: number): Texture[] {
  const frames: Texture[] = []
  for (let phase = 0; phase < WATER_BORDER_ANIMATION_PHASES; phase++) {
    try {
      frames.push(getTextureByFrame(resourceName, frameIndex + phase * WATER_BORDER_BASE_FRAME_COUNT, Assets))
    } catch {
      break
    }
  }
  return frames
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
    const textureRef = getDeterministicCellVariant(assets, this.cell.i, this.cell.j, this.cell.map?.seed)
    return textureRef ? getTexture(textureRef, Assets) : null
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
    cell.sprite.renderable = cell.category !== 'Water'

    cell.x = x
    cell.y = y - cell.z * CELL_DEPTH
    cell.inclined = false
    cell.border = false
    cell.waterBorder = false
    cell.unregisterWaterBorderSurface?.()
    cell.unregisterWaterBorderSurface = null
    if (cell._terrainAppearance) {
      cell._terrainAppearance.patchBorders = null
      cell._terrainAppearance.patchBorderGroundType = null
      cell._terrainAppearance.relief = null
      cell._terrainAppearance.waterBorder = null
    }
  }

  setTerrainType(type: string): void {
    const { cell } = this
    const config = Assets.cache.get('config') as TerrainConfig
    const definition = config?.cells?.[type]
    if (!definition) return

    const previousType = cell.type
    cell.type = type
    Object.assign(cell, definition)
    const textureRef = getDeterministicCellVariant(definition.assets || [], cell.i, cell.j, cell.map?.seed)
    if (textureRef) cell.terrainTextureName = textureRefToString(textureRef)
    if ((previousType === 'Water') !== (type === 'Water')) {
      asTerrainParent(cell.parent)?.invalidateReliefCoastDistances?.()
    }
    this.resetTerrainAppearance()
  }

  // Shared by both patch ground types that get a border ring (Desert, and the Dirt
  // patches on Temperate/BlackForest/Jungle). `groundType` picks the sheet explicitly —
  // callers that react to a specific cell.type (formatCellsPatchBorders) pass it through;
  // callers that decorate water edges universally (formatCellsWaterBorderOverlays, and
  // chunk/fog restore) omit it and get the desert sheet, matching every environment.
  setPatchBorder(direction: string, groundType: PatchBorderGroundType = 'Desert'): void {
    const { cell } = this
    if (!cell.sprite) return
    const alreadySet = cell.children.some(c => c.type === 'border' && c.direction === direction)
    if (alreadySet) return
    const resourceName =
      groundType === 'Dirt'
        ? BORDER_SHEETS.dirtRelief
        : groundType === 'Snow'
          ? BORDER_SHEETS.snowRelief
          : BORDER_SHEETS.desertRelief
    const cellSpriteTextureName = cell.terrainTextureName
    if (!cellSpriteTextureName) return
    // Relief formatting runs before biome borders. The base terrain reference is
    // still the original flat tile, while the sprite may already display a
    // relief frame (013..024). Use the frame that was actually applied.
    const cellSpriteIndex = cell._terrainAppearance?.relief?.index ?? parseTextureRef(cellSpriteTextureName).frame
    const dirIndex = ({ west: 0, north: 1, south: 2, east: 3 } satisfies Record<Direction, number>)[
      direction as Direction
    ]
    const variants = getReliefBorderVariants(cellSpriteIndex)
    const index = variants[dirIndex]
    if (index == null) return
    const textureName = formatNumber(index) + '.png'
    const texture = getTextureByFrame(resourceName, index, Assets)
    if (!texture) {
      console.log(
        `[ground-relief-border] Missing texture "${textureName}" for tile ${cellSpriteTextureName} at [${cell.i},${cell.j}]`
      )
      return
    }
    const sprite = new Sprite(texture) as TerrainSprite
    sprite.direction = direction as Direction
    sprite.anchor.set(Math.floor(texture.width / 2) / texture.width, Math.floor(texture.height / 2) / texture.height)
    sprite.type = 'border'
    sprite.zIndex = 10
    cell.addChild(sprite)
    if (cell._terrainAppearance) {
      if (!cell._terrainAppearance.patchBorders) cell._terrainAppearance.patchBorders = new Set()
      cell._terrainAppearance.patchBorders.add(direction)
      cell._terrainAppearance.patchBorderGroundType = groundType
    }
  }

  setWaterBorder(resourceName: string, index: number): void {
    const { cell } = this
    const { sprite } = cell
    if (!sprite) return
    const frameIndex = Number(index)
    const texture = getTextureByFrame(resourceName, frameIndex, Assets)
    const frames = getWaterBorderAnimationFrames(resourceName, frameIndex)
    cell.border = true
    cell.waterBorder = true
    if (cell.has && typeof cell.has.die === 'function') {
      cell.has.die()
    }
    sprite.zIndex = 1
    sprite.texture = texture
    sprite.renderable = true
    sprite.anchor.set(Math.floor(texture.width / 2) / texture.width, Math.floor(texture.height / 2) / texture.height)
    cell.terrainTextureName = textureRefToString({ sheet: resourceName, frame: frameIndex })
    cell.unregisterWaterBorderSurface?.()
    cell.unregisterWaterBorderSurface =
      frames.length > 1 ? (cell.context.map.registerWaterBorderSurface?.(sprite, frames) ?? null) : null
    if (cell._terrainAppearance) cell._terrainAppearance.waterBorder = { resourceName, index: frameIndex }
  }

  setReliefBorder(index: number, elevation: number = 0): void {
    const { cell } = this
    const { sprite } = cell
    if (!sprite) return
    const reliefIndex = Number(index)
    const baseTexture = sprite.texture
    const label = cell.terrainTextureName
    if (!label) {
      console.log(`[relief] BAD TERRAIN TEXTURE REF at [${cell.i},${cell.j}]: "${label}"`)
      return
    }
    const resourceName = parseTextureRef(label).sheet
    const texture = getTextureByFrame(resourceName, reliefIndex, Assets)

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
    if (cell._terrainAppearance) cell._terrainAppearance.relief = { index: reliefIndex, elevation }
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
    cell.sprite.texture = Texture.EMPTY
    cell.sprite.renderable = false
    cell.type = 'Water'
    cell.category = 'Water'
    cell.terrainTextureName = ''
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
