import { Sprite, Texture } from 'pixi.js'
import { Assets } from 'pixi.js'
import {
  getBuildingAsset,
  getTexture,
  changeSpriteColorDirectly,
  playerCanSeeInstance,
  updateInstanceRenderVisibility,
} from '../../lib'
import { COLOR_FOG, COLOR_WHITE, FAMILY_TYPES, LABEL_TYPES } from '../../constants'

let _fogPatternTexture = null

export const _DW = 64
export const _DH = 32

// 2x2 repeating checkerboard used by the viewport fog mask.
export function getFogPatternTexture() {
  if (_fogPatternTexture) return _fogPatternTexture
  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 2
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, 1, 1)
  ctx.fillRect(1, 1, 1, 1)
  _fogPatternTexture = Texture.from(canvas)
  return _fogPatternTexture
}

export class CellFog {
  constructor(cell) {
    this.cell = cell
  }

  addFogBuilding(textureSheet, colorName) {
    const { cell } = this
    if (cell.fogSprites.length > 0) return
    if (cell.context.map.revealTerrain && !cell.context.map.revealEverything) return

    const fogLayer = cell.context.map.fogLayer
    const addToLayer = sp => {
      sp.x = cell.x
      sp.y = cell.y
      sp.zIndex = 0
      if (fogLayer) fogLayer.addChild(sp)
      else cell.addChild(sp)
    }

    const sprite = Sprite.from(getTexture(textureSheet, Assets))
    sprite.label = LABEL_TYPES.buildingFog
    sprite.tint = COLOR_FOG
    sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y)
    sprite.cullable = true
    changeSpriteColorDirectly(sprite, colorName)
    addToLayer(sprite)
    cell.fogSprites.push({ sprite, textureSheet, colorName })
  }

  removeFogBuilding(instance) {
    const { cell } = this
    const { map } = cell.context
    if (instance.owner && !instance.owner.isPlayed && instance.family === FAMILY_TYPES.building) {
      const localCell = map.grid[instance.i][instance.j]
      localCell.fogSprites.forEach(s => s.sprite?.destroy())
      localCell.fogSprites = []
    }
  }

  setFogChildren(instance, init) {
    const { cell } = this
    const { player, map } = cell.context
    if (!playerCanSeeInstance(instance, player)) {
      if (instance.owner && !instance.owner.isPlayed) {
        if (!init && instance.family === FAMILY_TYPES.building) {
          if (!map.revealTerrain) {
            const assets = getBuildingAsset(instance.type, instance.owner, Assets)
            const localCell = map.grid[instance.i][instance.j]
            localCell.addFogBuilding(assets.images.final, instance.owner.color)
          }
        }
        instance.visible = false
      }
    }
  }

  _setRemoveChildren(instance) {
    updateInstanceRenderVisibility(instance)
    for (let i = 0; i < instance.children.length; i++) {
      if (instance.children[i].tint) {
        instance.children[i].tint = COLOR_WHITE
      }
    }
  }

  setFog(init) {
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

  removeFog() {
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
    if (cell.has) {
      this.removeFogBuilding(cell.has)
      this._setRemoveChildren(cell.has)
    }
    for (const corpse of cell.corpses) {
      this._setRemoveChildren(corpse)
    }
  }
}
