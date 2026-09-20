import { getReliefAppearance } from '../../../lib/terrain/reliefAppearance'
import { Assets, Container, Sprite } from 'pixi.js'
import { cartesianToIsometric } from '../../../lib/maths'
import { getDeterministicCellVariant } from '../../../lib/random'
import { getTexture } from '../../../lib/graphics/textures'
import { CELL_DEPTH } from '../../../constants'
import { getNeighborFlags } from '../../../lib/terrain/topology'
import { debugLog } from '../../../lib/debug'
import type { TerrainCell, TerrainMap } from './MapTerrainTypes'
import type { TextureRef } from '../../../lib'

type TerrainDefinition = {
  category?: string
  color?: string | number
  assets?: TextureRef[]
  [key: string]: string | TextureRef[] | number | boolean | undefined
}

type TerrainConfig = {
  cells?: Record<string, TerrainDefinition>
}

const TERRAIN_RELIEF_DEBUG = false

export function rebuildTerrainBackfill(map: TerrainMap): void {
  let layer = map.terrainBackfill
  if (!layer) {
    layer = new Container()
    layer.label = 'terrainBackfill'
    layer.eventMode = 'none'
    layer.zIndex = -2
    layer.sortableChildren = true
    map.terrainBackfill = layer
  }

  if (layer.parent !== map) map.addChild(layer)
  for (const child of layer.removeChildren()) child.destroy()
  layer.visible = true

  const config = Assets.cache.get('config') as TerrainConfig
  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      const cell = map.grid[i][j]
      if (!cell) continue
      const isMapEdge = !map.grid[i - 1]?.[j] || !map.grid[i + 1]?.[j] || !map.grid[i]?.[j - 1] || !map.grid[i]?.[j + 1]
      if (!isMapEdge || cell.z === 0) continue

      const assets = config?.cells?.[cell.type]?.assets || []
      if (!assets.length) continue

      const textureRef = getDeterministicCellVariant(assets, i, j, map.seed)
      if (!textureRef) continue
      const texture = getTexture(textureRef, Assets)
      if (!texture) continue

      const [x, y] = cartesianToIsometric(i, j)
      const addBackfillSprite = (level: number) => {
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
      const direction = Math.sign(cell.z)
      for (let level = direction; level !== cell.z + direction; level += direction) {
        addBackfillSprite(level)
      }
    }
  }
}

export function formatTerrainRelief(map: TerrainMap, backfill = true): void {
  if (backfill) rebuildTerrainBackfill(map)
  formatTerrainReliefCells(map)
}

export function formatTerrainReliefCells(map: Pick<TerrainMap, 'size' | 'grid'>): void {
  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      const cell = map.grid[i][j]
      if (!cell) continue
      if (cell.category === 'Water' || cell.waterBorder) continue

      const { n, s, w, e, nw, ne, sw, se } = getNeighborFlags(
        map.grid,
        i,
        j,
        (neighbor: TerrainCell | undefined) => (neighbor?.z ?? cell.z) > cell.z
      )

      const appearance = getReliefAppearance({ n, s, w, e, nw, ne, sw, se })
      if (appearance) {
        cell.setReliefBorder?.(String(appearance.index).padStart(3, '0'), appearance.elevation)
      } else if (nw || ne || sw || se) {
        debugLog(
          TERRAIN_RELIEF_DEBUG,
          `[relief] UNHANDLED diagonal at [${i},${j}] z=${cell.z} NW=${nw} NE=${ne} SW=${sw} SE=${se}`
        )
      }
    }
  }
}
