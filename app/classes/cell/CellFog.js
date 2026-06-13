import { Sprite, Texture } from 'pixi.js'
import { Assets } from 'pixi.js'
import { getBuildingAsset, getTexture, changeSpriteColorDirectly, playerCanSeeInstance } from '../../lib'
import { COLOR_FOG, COLOR_WHITE, FAMILY_TYPES, LABEL_TYPES } from '../../constants'

let _fogTexture = null
let _darknessTexture = null
let _fogPatternTexture = null

export const _DW = 64
export const _DH = 32

function _insideDiamond(px, py) {
  return px + 2 * py >= 32 && px - 2 * py <= 32 && px - 2 * py >= -32 && px + 2 * py <= 96
}

export function getFogTexture() {
  if (_fogTexture) return _fogTexture
  const canvas = document.createElement('canvas')
  canvas.width = _DW
  canvas.height = _DH
  const ctx = canvas.getContext('2d')
  for (let px = 0; px < _DW; px++) {
    for (let py = 0; py < _DH; py++) {
      if (!_insideDiamond(px, py)) continue
      if ((px + py) % 2 !== 0) continue
      ctx.fillStyle = '#000'
      ctx.fillRect(px, py, 1, 1)
    }
  }
  _fogTexture = Texture.from(canvas)
  return _fogTexture
}

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

// Solid black diamond for cells never explored
export function getDarknessTexture() {
  if (_darknessTexture) return _darknessTexture
  const canvas = document.createElement('canvas')
  canvas.width = _DW
  canvas.height = _DH
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000'
  for (let px = 0; px < _DW; px++) {
    for (let py = 0; py < _DH; py++) {
      if (_insideDiamond(px, py)) ctx.fillRect(px, py, 1, 1)
    }
  }
  _darknessTexture = Texture.from(canvas)
  return _darknessTexture
}

export class CellFog {
  constructor(cell) {
    this.cell = cell
  }

  addFogBuilding(textureSheet, colorSheet, colorName) {
    const { cell } = this
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
    addToLayer(sprite)
    cell.fogSprites.push({ sprite, textureSheet, colorSheet, colorName })
    if (colorSheet) {
      const spriteColor = Sprite.from(getTexture(colorSheet, Assets))
      spriteColor.label = LABEL_TYPES.buildingFog
      spriteColor.tint = COLOR_FOG
      changeSpriteColorDirectly(spriteColor, colorName)
      addToLayer(spriteColor)
      cell.fogSprites.push({ sprite: spriteColor, textureSheet, colorSheet, colorName })
    } else {
      changeSpriteColorDirectly(sprite, colorName)
    }
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
            localCell.addFogBuilding(assets.images.final, assets.images.color, instance.owner.color)
          }
        }
        instance.visible = false
      }
    }
  }

  _setRemoveChildren(instance) {
    const { cell } = this
    const { controls, map } = cell.context
    if (instance.family === FAMILY_TYPES.resource && !map.showResources) {
      instance.visible = false
      return
    }

    if (controls.instanceInCamera(instance)) {
      instance.visible = true
    }
    for (let i = 0; i < instance.children.length; i++) {
      if (instance.children[i].tint) {
        instance.children[i].tint = COLOR_WHITE
      }
    }
  }

  _updateEdgeDither() {
    const { cell } = this
    const fogLayer = cell.context.map.fogLayer
    if (cell._ditherSprite) {
      if (fogLayer) fogLayer.removeChild(cell._ditherSprite)
      cell._ditherSprite.destroy()
      cell._ditherSprite = null
    }
    cell._ditherKey = null
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
    this._updateEdgeDither()
    const { grid } = cell.context.map
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        if (di === 0 && dj === 0) continue
        grid[cell.i + di]?.[cell.j + dj]?.cellFog._updateEdgeDither()
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
    this._updateEdgeDither()
    const { grid } = cell.context.map
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        if (di === 0 && dj === 0) continue
        grid[cell.i + di]?.[cell.j + dj]?.cellFog._updateEdgeDither()
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
