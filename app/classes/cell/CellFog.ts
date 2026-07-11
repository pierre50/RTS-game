import { Sprite, Texture } from 'pixi.js'
import { Assets } from 'pixi.js'
import {
  getBuildingAsset,
  getBuildingAssetOwner,
  getTexture,
  changeSpriteColorDirectly,
  playerCanSeeInstance,
  updateInstanceRenderVisibility,
} from '../../lib'
import { COLOR_WHITE, FAMILY_TYPES, LABEL_TYPES } from '../../constants'
import type { RuntimeEntity } from '../../types/entities'
import type { FogSpriteMemory, RuntimeCell } from '../../types/map'
import type { BuildingWithAssetOwner, RecolorableSprite } from '../../lib'

type FogMemorySprite = FogSpriteMemory & {
  sprite?: Sprite
}

export type FogMapLike = {
  revealTerrain?: boolean
  revealEverything?: boolean
  fogMemoryLayer?: { addChild(child: Sprite): Sprite } | null
  grid?: RuntimeCell[][]
  _fogQueue?: Map<FogCellLike, string>
  _fogInitComplete?: boolean
}

export type FogCellContext = {
  map: FogMapLike
  player?: { views?: { isViewed(i: number, j: number): boolean; isVisible(i: number, j: number): boolean } }
}

type FogInstance = RuntimeEntity & {
  assetType?: string
  children?: Array<{ tint?: number }>
  owner?: RuntimeEntity['owner'] & { isPlayed?: boolean; color?: string }
  visible?: boolean
}

type FogGridCell = RuntimeCell & {
  addFogBuilding?(textureSheet: string, colorName?: string): void
}

export type FogCellLike = {
  context: FogCellContext
  i: number
  j: number
  x: number
  y: number
  visible: boolean
  zIndex: number
  _hasFog: boolean
  has: FogInstance | null
  corpses: Set<FogInstance>
  fogSprites: FogMemorySprite[]
  addChild(child: Sprite): Sprite
  addFogBuilding(textureSheet: string, colorName?: string): void
}

type BuildingAssetWithFinalImage = {
  images: { final: string }
}

let _fogPatternTexture: Texture | null = null

export const _DW = 64
export const _DH = 32

// 2x2 repeating checkerboard used by the viewport fog mask.
export function getFogPatternTexture(): Texture {
  if (_fogPatternTexture) return _fogPatternTexture
  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 2
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create fog pattern canvas context')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, 1, 1)
  ctx.fillRect(1, 1, 1, 1)
  _fogPatternTexture = Texture.from(canvas)
  return _fogPatternTexture
}

export class CellFog {
  cell: FogCellLike

  constructor(cell: FogCellLike) {
    this.cell = cell
  }

  addFogBuilding(textureSheet: string, colorName?: string): void {
    const { cell } = this
    if (cell.fogSprites.length > 0) return
    if (cell.context.map.revealTerrain && !cell.context.map.revealEverything) return

    const fogMemoryLayer = cell.context.map.fogMemoryLayer
    const addToLayer = (sp: Sprite) => {
      sp.x = cell.x
      sp.y = cell.y
      sp.zIndex = cell.i + cell.j
      if (fogMemoryLayer) fogMemoryLayer.addChild(sp)
      else cell.addChild(sp)
    }

    const sprite = Sprite.from(getTexture(textureSheet, Assets))
    sprite.label = LABEL_TYPES.buildingFog
    sprite.anchor.set(sprite.texture.defaultAnchor?.x ?? 0.5, sprite.texture.defaultAnchor?.y ?? 0.5)
    sprite.cullable = true
    if (colorName) {
      changeSpriteColorDirectly(sprite as RecolorableSprite, colorName)
    }
    addToLayer(sprite)
    cell.fogSprites.push({ sprite, textureSheet, colorName })
  }

  removeFogBuilding(instance: FogInstance | null = null): void {
    const { cell } = this
    const targetCell = instance ? cell.context.map.grid?.[instance.i]?.[instance.j] : cell
    if (!targetCell) return
    ;(targetCell.fogSprites as FogMemorySprite[]).forEach(s => s.sprite?.destroy())
    targetCell.fogSprites = []
  }

  setFogChildren(instance: FogInstance, init: boolean): void {
    const { cell } = this
    const { player, map } = cell.context
    if (!playerCanSeeInstance(instance, player)) {
      if (instance.owner && !instance.owner.isPlayed) {
        if (!init && instance.family === FAMILY_TYPES.building) {
          if (!map.revealTerrain) {
            const assets = getBuildingAsset(
              instance.assetType || instance.type,
              getBuildingAssetOwner(instance as BuildingWithAssetOwner),
              Assets
            ) as BuildingAssetWithFinalImage
            const localCell = map.grid?.[instance.i]?.[instance.j] as FogGridCell | undefined
            if (!localCell?.addFogBuilding) return
            localCell.addFogBuilding(assets.images.final, instance.owner.color)
          }
        }
        instance.visible = false
      }
    }
  }

  _setRemoveChildren(instance: FogInstance): void {
    updateInstanceRenderVisibility(instance)
    for (let i = 0; i < (instance.children?.length ?? 0); i++) {
      const child = instance.children?.[i]
      if (child?.tint) {
        child.tint = COLOR_WHITE
      }
    }
  }

  setFog(init: boolean): void {
    const { cell } = this
    if (cell.has && !cell.has.isDead) {
      this.setFogChildren(cell.has, init)
    }
    if (!cell._hasFog) {
      cell._hasFog = true
      const { map } = cell.context
      if (map._fogQueue) {
        const viewed = cell.context.player?.views?.isViewed(cell.i, cell.j) ?? false
        const isViewed = viewed || map.revealTerrain
        // During init, chunks are already solid black — only queue if cell was viewed
        // (needs dotted pattern) or if init is already complete (re-fogging during gameplay)
        if (isViewed || map._fogInitComplete) {
          map._fogQueue.set(cell, isViewed ? 'fogViewed' : 'fog')
        }
      }
    }
  }

  removeFog(): void {
    const { cell } = this
    cell.visible = true
    cell.zIndex = 0
    if (cell._hasFog) {
      cell._hasFog = false
      const { map } = cell.context
      if (map._fogQueue) {
        map._fogQueue.set(cell, 'clear')
      }
    }
    this.removeFogBuilding()
    if (cell.has) {
      if (cell.has.family === FAMILY_TYPES.building) this.removeFogBuilding(cell.has)
      this._setRemoveChildren(cell.has)
    }
    for (const corpse of cell.corpses) {
      if (corpse.family === FAMILY_TYPES.building) this.removeFogBuilding(corpse)
      this._setRemoveChildren(corpse)
    }
  }
}
