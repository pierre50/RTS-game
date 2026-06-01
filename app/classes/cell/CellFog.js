import { Sprite, Texture } from 'pixi.js'
import { Assets } from 'pixi.js'
import { getBuildingAsset, getTexture, changeSpriteColorDirectly, instanceIsInPlayerSight } from '../../lib'
import { COLOR_FOG, COLOR_WHITE, FAMILY_TYPES, LABEL_TYPES } from '../../constants'

// Which side to show per cardinal neighbor (di, dj)
const NEIGHBOR_SIDES = {
  '-1,0': 'NW',
  '0,-1': 'NE',
  '0,1':  'SW',
  '1,0':  'SE',
}

// Inner-corner: diagonal neighbor in fog, both shared cardinals visible
const CORNER_DATA = {
  '-1,-1': { corner: 'N', adj: [[-1, 0], [0, -1]] },
  '1,-1':  { corner: 'E', adj: [[0, -1], [1, 0]] },
  '1,1':   { corner: 'S', adj: [[1, 0], [0, 1]] },
  '-1,1':  { corner: 'W', adj: [[0, 1], [-1, 0]] },
}

const _NEIGHBOR_LIST = Object.entries(NEIGHBOR_SIDES).map(([k, side]) => {
  const [di, dj] = k.split(',').map(Number)
  return { di, dj, side }
})
const _CORNER_LIST = Object.entries(CORNER_DATA).map(([k, { corner, adj }]) => {
  const [di, dj] = k.split(',').map(Number)
  return { di, dj, corner, adj }
})

const _ditherTextures = {}
let _fogTexture = null
let _darknessTexture = null

export const _DW = 64
export const _DH = 32
export const _DAX = 32
export const _DAY = 16

function _insideDiamond(px, py) {
  return (
    px + 2 * py >= 32 &&
    px - 2 * py <= 32 &&
    px - 2 * py >= -32 &&
    px + 2 * py <= 96
  )
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

function getDitherTexture(sides, corners = new Set()) {
  const sidesKey = ['NW', 'NE', 'SE', 'SW'].filter(s => sides.has(s)).join('|')
  const cornersKey = ['N', 'E', 'S', 'W'].filter(c => corners.has(c)).join('|')
  if (!sidesKey && !cornersKey) return null
  const key = sidesKey + (cornersKey ? '|C:' + cornersKey : '')
  if (_ditherTextures[key]) return _ditherTextures[key]

  const canvas = document.createElement('canvas')
  canvas.width = _DW
  canvas.height = _DH
  const ctx = canvas.getContext('2d')
  const K = 10

  for (let px = 0; px < _DW; px++) {
    for (let py = 0; py < _DH; py++) {
      if (!_insideDiamond(px, py)) continue

      const dNW = (px + 2 * py) - 32
      const dNE = 32 - (px - 2 * py)
      const dSE = 96 - (px + 2 * py)
      const dSW = (px - 2 * py) + 32

      let inBand = false
      if (sides.has('NW') && !inBand && dNW >= 0 && dNW <= K) inBand = true
      if (sides.has('NE') && !inBand && dNE >= 0 && dNE <= K) inBand = true
      if (sides.has('SE') && !inBand && dSE >= 0 && dSE <= K) inBand = true
      if (sides.has('SW') && !inBand && dSW >= 0 && dSW <= K) inBand = true

      if (corners.has('N') && !inBand && dNW >= 0 && dNW <= K && dNE >= 0 && dNE <= K) inBand = true
      if (corners.has('E') && !inBand && dNE >= 0 && dNE <= K && dSE >= 0 && dSE <= K) inBand = true
      if (corners.has('S') && !inBand && dSE >= 0 && dSE <= K && dSW >= 0 && dSW <= K) inBand = true
      if (corners.has('W') && !inBand && dSW >= 0 && dSW <= K && dNW >= 0 && dNW <= K) inBand = true

      if (!inBand) continue
      if ((px + py) % 2 !== 0) continue

      ctx.fillStyle = '#000'
      ctx.fillRect(px, py, 1, 1)
    }
  }

  _ditherTextures[key] = Texture.from(canvas)
  return _ditherTextures[key]
}

export class CellFog {
  constructor(cell) {
    this.cell = cell
  }

  addFogBuilding(textureSheet, colorSheet, colorName) {
    const { cell } = this
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
    if (!instanceIsInPlayerSight(instance, player)) {
      if (instance.owner && !instance.owner.isPlayed) {
        if (!init && instance.family === FAMILY_TYPES.building) {
          const assets = getBuildingAsset(instance.type, instance.owner, Assets)
          const localCell = map.grid[instance.i][instance.j]
          localCell.addFogBuilding(assets.images.final, assets.images.color, instance.owner.color)
        }
        instance.visible = false
      }
    }
  }

  _setRemoveChildren(instance) {
    const { cell } = this
    const { controls } = cell.context
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
    const needed = new Set()
    const neededCorners = new Set()

    if (cell.visible && cell.viewBy.size > 0 && !cell._hasFog) {
      const { grid } = cell.context.map
      for (const { di, dj, side } of _NEIGHBOR_LIST) {
        const n = grid[cell.i + di]?.[cell.j + dj]
        if (!n || n._hasFog) needed.add(side)
      }
      for (const { di, dj, corner, adj } of _CORNER_LIST) {
        const diag = grid[cell.i + di]?.[cell.j + dj]
        if (!diag || diag._hasFog) {
          const bothVisible = adj.every(([cdi, cdj]) => {
            const cn = grid[cell.i + cdi]?.[cell.j + cdj]
            return cn && !cn._hasFog
          })
          if (bothVisible) neededCorners.add(corner)
        }
      }
    }

    // Compute key and skip update if nothing changed
    const sidesKey = ['NW', 'NE', 'SE', 'SW'].filter(s => needed.has(s)).join('|')
    const cornersKey = ['N', 'E', 'S', 'W'].filter(c => neededCorners.has(c)).join('|')
    const ditherKey = sidesKey + (cornersKey ? '|C:' + cornersKey : '')
    if (cell._ditherKey === ditherKey) return
    cell._ditherKey = ditherKey

    const fogLayer = cell.context.map.fogLayer
    if (!fogLayer) return
    if (needed.size > 0 || neededCorners.size > 0) {
      const texture = getDitherTexture(needed, neededCorners)
      if (!cell._ditherSprite) {
        cell._ditherSprite = new Sprite(texture)
        cell._ditherSprite.label = LABEL_TYPES.dither
        cell._ditherSprite.anchor.set(_DAX / _DW, _DAY / _DH)
        cell._ditherSprite.eventMode = 'none'
        cell._ditherSprite.cullable = true
        cell._ditherSprite.zIndex = 2
        cell._ditherSprite.x = cell.x
        cell._ditherSprite.y = cell.y
        fogLayer.addChild(cell._ditherSprite)
      } else {
        cell._ditherSprite.texture = texture
      }
    } else {
      if (cell._ditherSprite) {
        fogLayer.removeChild(cell._ditherSprite)
        cell._ditherSprite.destroy()
        cell._ditherSprite = null
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
        const viewed = cell.context.player.views[cell.i]?.[cell.j]?.viewed ?? false
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
