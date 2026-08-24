import { Assets, Container, Sprite } from 'pixi.js'
import { cartesianToIsometric, getDeterministicCellVariant, getTexture } from '../../lib'
import { CELL_DEPTH } from '../../constants'
import { getNeighborFlags } from '../../lib/terrain/topology'
import { debugLog } from '../../lib/debug'
import type { TerrainCell, TerrainMap } from './MapTerrainTypes'
import type { TextureRef } from '../../lib'

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
      const isMapEdge = i === 0 || j === 0 || i === map.size || j === map.size
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
        sprite.anchor.set(Math.floor(texture.width / 2) / texture.width, Math.floor(texture.height / 2) / texture.height)
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

export function formatTerrainRelief(map: TerrainMap): void {
  rebuildTerrainBackfill(map)

  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      const cell = map.grid[i][j]
      if (cell.category === 'Water' || cell.waterBorder) continue

      const { n, s, w, e, nw, ne, sw, se } = getNeighborFlags(
        map.grid,
        i,
        j,
        (neighbor: TerrainCell | undefined) => (neighbor?.z ?? cell.z) > cell.z
      )

      if (n && !s && !w && !e) {
        cell.setReliefBorder?.('014', CELL_DEPTH / 2)
      } else if (s && !n && !w && !e) {
        cell.setReliefBorder?.('015', CELL_DEPTH / 2)
      } else if (w && !n && !s && !e) {
        cell.setReliefBorder?.('016', CELL_DEPTH / 2)
      } else if (e && !n && !s && !w) {
        cell.setReliefBorder?.('013', CELL_DEPTH / 2)
      } else if (nw && !n && !w) {
        cell.setReliefBorder?.('010', CELL_DEPTH / 2)
      } else if (sw && !s && !w) {
        cell.setReliefBorder?.('012')
      } else if (ne && !n && !e) {
        cell.setReliefBorder?.('011')
      } else if (se && !s && !e) {
        cell.setReliefBorder?.('009', CELL_DEPTH / 2)
      } else if (w && n && !s && !e) {
        cell.setReliefBorder?.('022', CELL_DEPTH / 2)
      } else if (e && s && !n && !w) {
        cell.setReliefBorder?.('021', CELL_DEPTH / 2)
      } else if (w && s && !n && !e) {
        cell.setReliefBorder?.('023', CELL_DEPTH)
      } else if (e && n && !s && !w) {
        cell.setReliefBorder?.('024', CELL_DEPTH)
      } else if (n && s && !w && !e) {
        cell.setReliefBorder?.('017', CELL_DEPTH / 2)
      } else if (w && e && !n && !s) {
        cell.setReliefBorder?.('018', CELL_DEPTH / 2)
      } else if (n && w) {
        cell.setReliefBorder?.('022', CELL_DEPTH / 2)
      } else if (s && e) {
        cell.setReliefBorder?.('021', CELL_DEPTH / 2)
      } else if (w && s) {
        cell.setReliefBorder?.('023', CELL_DEPTH)
      } else if (e && n) {
        cell.setReliefBorder?.('024', CELL_DEPTH)
      } else if (n || s) {
        cell.setReliefBorder?.('017', CELL_DEPTH / 2)
      } else if (w || e) {
        cell.setReliefBorder?.('018', CELL_DEPTH / 2)
      } else if (nw || ne || sw || se) {
        debugLog(
          TERRAIN_RELIEF_DEBUG,
          `[relief] UNHANDLED diagonal at [${i},${j}] z=${cell.z} NW=${nw} NE=${ne} SW=${sw} SE=${se}`
        )
      }
    }
  }
}
