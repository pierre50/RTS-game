import { Container, Assets, Sprite, Texture } from 'pixi.js'
import {
  randomRange,
  formatNumber,
  cartesianToIsometric,
  getCellsAroundPoint,
  instanceIsInPlayerSight,
  instancesDistance,
  getInstanceZIndex,
  getBuildingAsset,
  getTexture,
  changeSpriteColorDirectly,
} from '../lib'
import { CELL_DEPTH, CELL_WIDTH, CELL_HEIGHT, COLOR_FOG, COLOR_WHITE, FAMILY_TYPES, LABEL_TYPES } from '../constants'

// Which side to show per cardinal neighbor (di, dj)
const NEIGHBOR_SIDES = {
  '-1,0': 'NW',
  '0,-1': 'NE',
  '0,1':  'SW',
  '1,0':  'SE',
}

// Inner-corner: diagonal neighbor in fog, both shared cardinals visible
// → draw a small dither patch at the diamond tip between the two cardinal edges
const CORNER_DATA = {
  '-1,-1': { corner: 'N', adj: [[-1, 0], [0, -1]] }, // N tip  (NW∩NE)
  '1,-1':  { corner: 'E', adj: [[0, -1], [1, 0]] },  // E tip  (NE∩SE)
  '1,1':   { corner: 'S', adj: [[1, 0], [0, 1]] },   // S tip  (SE∩SW)
  '-1,1':  { corner: 'W', adj: [[0, 1], [-1, 0]] },  // W tip  (SW∩NW)
}

// Cache keyed by sorted sides e.g. 'NE|NW|SW'
const _ditherTextures = {}
let _fogTexture = null

const _DW = 64
const _DH = 32
const _DAX = 32
const _DAY = 16

function _insideDiamond(px, py) {
  return (
    px + 2 * py >= 32 &&
    px - 2 * py <= 32 &&
    px - 2 * py >= -32 &&
    px + 2 * py <= 96
  )
}

function getFogTexture() {
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

// sides = Set of 'NW','NE','SE','SW', corners = Set of 'N','E','S','W'
// ONE combined texture — zero overlap possible
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

      // Inner-corner tips: both adjacent edge distances must be small
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

export class Cell extends Container {
  constructor(options, context) {
    super()

    this.context = context

    const {
      context: { map },
    } = this
    this.family = FAMILY_TYPES.cell
    this.map = map

    this.solid = false
    this.visible = false
    this.zIndex = 0
    this.inclined = false
    this.border = false
    this.waterBorder = false
    this.z = 0
    this.viewed = false
    this.viewBy = new Set()
    this.has = null
    this.corpses = new Set()
    this.fogSprites = []
    this._ditherSprite = null

    Object.keys(options).forEach(prop => {
      this[prop] = options[prop]
    })
    Object.keys(Assets.cache.get('config').cells[this.type]).forEach(prop => {
      this[prop] = Assets.cache.get('config').cells[this.type][prop]
    })
    const pos = cartesianToIsometric(this.i, this.j)

    this.x = pos[0]
    this.y = pos[1] - this.z * CELL_DEPTH

    const textureName = randomItem(this.assets)
    const resourceName = textureName.split('_')[1]
    const textureFile = textureName + '.png'
    const spritesheet = Assets.cache.get(resourceName)
    const texture = spritesheet.textures[textureFile]
    this.sprite = Sprite.from(texture)
    this.sprite.label = LABEL_TYPES.sprite
    this.sprite.anchor.set(0.5, 0.5)
    this.sprite.roundPixels = true
    this.sprite.allowMove = false
    this.sprite.eventMode = 'none'
    this.sprite.allowClick = false
    this.addChild(this.sprite)

    this.fogSprites.forEach(sprite => this.addFogBuilding(...Object.values(sprite)))

    this.eventMode = 'none'
    this.allowMove = false
    this.allowClick = false
  }

  updateVisible() {
    const {
      context: { map, player },
    } = this

    function updateChild(instance) {
      if (
        map.revealEverything ||
        !instance.owner ||
        instance.owner.isPlayed ||
        instanceIsInPlayerSight(instance, player)
      ) {
        instance.visible = true
      }
    }

    if (!map.revealEverything && !player.views[this.i][this.j].viewed) {
      return
    }
    this.visible = true
    if (this.has) {
      updateChild(this.has)
    }
    for (const corpse of this.corpses) {
      updateChild(corpse)
    }
  }

  setDesertBorder(direction) {
    const resourceName = '20002'
    const { sprite: cellSprite } = this
    const cellSpriteTextureName = cellSprite.texture.label
    const cellSpriteIndex = cellSpriteTextureName.split('_')[0]
    let val = {}
    let index
    let cpt = 0
    for (let i = 0; i < 25; i++) {
      val[i] = []
      if (i < 9) {
        val[i].push(0, 1, 2, 3)
      } else {
        for (let j = cpt; j < cpt + 4; j++) {
          val[i].push(j + 4)
        }
        cpt += 4
      }
    }
    switch (direction) {
      case 'west':
        index = val[cellSpriteIndex * 1][0]
        break
      case 'north':
        index = val[cellSpriteIndex * 1][1]
        break
      case 'south':
        index = val[cellSpriteIndex * 1][2]
        break
      case 'est':
        index = val[cellSpriteIndex * 1][3]
        break
    }
    const spritesheet = Assets.cache.get(resourceName)
    const texture = spritesheet.textures[formatNumber(index) + '_' + resourceName + '.png']
    const sprite = Sprite.from(texture)
    sprite.direction = direction
    sprite.anchor.set(0.5, 0.5)
    sprite.type = 'border'
    this.addChild(sprite)
  }

  setWaterBorder(resourceName, index) {
    const { sprite } = this
    const spritesheet = Assets.cache.get(resourceName)
    const texture = spritesheet.textures[index + '_' + resourceName + '.png']
    this.type = 'Desert'
    this.border = true
    this.waterBorder = true
    if (this.has && typeof this.has.die === 'function') {
      this.has.die(true)
    }
    sprite.texture = texture
  }

  setReliefBorder(index, elevation = 0) {
    const { sprite } = this
    const resourceName = sprite.texture.label.split('_')[1].split('.')[0]
    const spritesheet = Assets.cache.get(resourceName)
    const texture = spritesheet.textures[index + '_' + resourceName + '.png']
    if (elevation) {
      this.y -= elevation
    }
    this.inclined = true
    if (this.has) {
      this.has.zIndex = getInstanceZIndex(this.has)
    }
    sprite.label = LABEL_TYPES.sprite
    sprite.anchor.set(0.5, 0.5)
    sprite.texture = texture
  }

  setWater() {
    const index = formatNumber(randomRange(0, 3))
    const resourceName = '15002'
    const spritesheet = Assets.cache.get(resourceName)
    this.sprite.texture = spritesheet.textures[index + '_' + resourceName + '.png']
    this.type = 'Water'
    this.category = 'Water'
  }
  fillWaterCellsAroundCell() {
    const grid = this.parent.grid
    if (this.type === 'Water' && !this.sprite.texture.label.includes('15002')) {
      this.setWater()
    }
    getCellsAroundPoint(this.i, this.j, grid, 2, cell => {
      if (cell.type === 'Water' && this.type === 'Water') {
        const dist = instancesDistance(this, cell)
        const velX = Math.round((this.i - cell.i) / dist)
        const velY = Math.round((this.j - cell.j) / dist)
        if (grid[cell.i + velX] && grid[cell.i + velX][cell.j + velY]) {
          const target = grid[cell.i + velX][cell.j + velY]
          const aside = grid[this.i + cell.i - target.i][this.j + cell.j - target.j]
          if (target.type !== this.type && aside.type !== this.type) {
            if (Math.floor(instancesDistance(this, cell)) === 2) {
              cell.setWater()
              target.setWater()
            }
          }
        }
      }
    })
  }

  fillReliefCellsAroundCell() {
    const grid = this.parent.grid
    getCellsAroundPoint(this.i, this.j, grid, 2, cell => {
      if (cell.z === this.z) {
        const dist = instancesDistance(this, cell)
        const velX = Math.round((this.i - cell.i) / dist)
        const velY = Math.round((this.j - cell.j) / dist)
        if (grid[cell.i + velX] && grid[cell.i + velX][cell.j + velY]) {
          const target = grid[cell.i + velX][cell.j + velY]
          const aside = grid[this.i + cell.i - target.i][this.j + cell.j - target.j]
          if (target.z <= this.z && target.z !== this.z && aside.z !== this.z) {
            if (Math.floor(instancesDistance(this, cell)) === 2) {
              target.setCellLevel(target.z + 1)
            }
          }
        }
      }
    })
  }

  setCellLevel(level, cpt = 1) {
    if (level === 0) {
      this.y += CELL_DEPTH
      this.z = level
      return
    }
    const grid = this.parent.grid
    getCellsAroundPoint(this.i, this.j, grid, level - cpt, cell => {
      if (cell.z < cpt) {
        cell.y -= (cpt - cell.z) * CELL_DEPTH
        cell.z = cpt
        cell.fillReliefCellsAroundCell(grid)
      }
    })
    if (cpt + 1 < level) {
      this.setCellLevel(level, cpt + 1)
    }
    if (this.has) {
      this.has.zIndex = getInstanceZIndex(this.has)
    }
  }

  addFogBuilding(textureSheet, colorSheet, colorName) {
    const sprite = Sprite.from(getTexture(textureSheet, Assets))
    sprite.label = LABEL_TYPES.buildingFog
    sprite.tint = COLOR_FOG
    sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y)
    this.addChild(sprite)
    this.fogSprites.push({ sprite, textureSheet, colorSheet, colorName })
    if (colorSheet) {
      const spriteColor = Sprite.from(getTexture(colorSheet, Assets))
      spriteColor.label = LABEL_TYPES.buildingFog
      spriteColor.tint = COLOR_FOG
      changeSpriteColorDirectly(spriteColor, colorName)
      this.addChild(spriteColor)
      this.fogSprites.push({ sprite: spriteColor, textureSheet, colorSheet, colorName })
    } else {
      changeSpriteColorDirectly(sprite, colorName)
    }
    this.zIndex = 100
  }

  removeFogBuilding(instance) {
    const { map } = this.context
    if (instance.owner && !instance.owner.isPlayed && instance.family === FAMILY_TYPES.building) {
      let i = 0
      const localCell = map.grid[instance.i][instance.j]
      while (i < localCell.fogSprites.length) {
        if (localCell.fogSprites[i]) {
          localCell.fogSprites[i].sprite?.destroy() // Destroy the sprite
          localCell.fogSprites.splice(i, 1) // Remove the destroyed sprite from the array
        } else {
          i++ // Only increment if no sprite is destroyed, to avoid skipping elements
        }
      }
    }
  }

  setFogChildren(instance, init) {
    const { player, map } = this.context
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

  _updateEdgeDither() {
    const needed = new Set()
    const neededCorners = new Set()
    const hasFogOverlay = this.children.some(c => c.label === LABEL_TYPES.fogOverlay)

    if (this.visible && this.viewBy.size > 0 && !hasFogOverlay) {
      const { grid } = this.context.map
      for (const [key, side] of Object.entries(NEIGHBOR_SIDES)) {
        const [di, dj] = key.split(',').map(Number)
        const n = grid[this.i + di]?.[this.j + dj]
        const neighborInFog = !n || n.children.some(c => c.label === LABEL_TYPES.fogOverlay)
        if (neighborInFog) needed.add(side)
      }
      // Inner-corner: diagonal in fog but both shared cardinals visible
      for (const [key, { corner, adj }] of Object.entries(CORNER_DATA)) {
        const [di, dj] = key.split(',').map(Number)
        const diag = grid[this.i + di]?.[this.j + dj]
        const diagInFog = !diag || diag.children.some(c => c.label === LABEL_TYPES.fogOverlay)
        if (diagInFog) {
          const bothVisible = adj.every(([cdi, cdj]) => {
            const cn = grid[this.i + cdi]?.[this.j + cdj]
            return cn && !cn.children.some(c => c.label === LABEL_TYPES.fogOverlay)
          })
          if (bothVisible) neededCorners.add(corner)
        }
      }
    }

    if (needed.size > 0 || neededCorners.size > 0) {
      const texture = getDitherTexture(needed, neededCorners)
      if (!this._ditherSprite) {
        this._ditherSprite = new Sprite(texture)
        this._ditherSprite.label = LABEL_TYPES.dither
        this._ditherSprite.anchor.set(_DAX / _DW, _DAY / _DH)
        this._ditherSprite.eventMode = 'none'
        this.addChild(this._ditherSprite)
      } else {
        this._ditherSprite.texture = texture
      }
    } else {
      if (this._ditherSprite) {
        this.removeChild(this._ditherSprite)
        this._ditherSprite = null
      }
    }
  }

  setFog(init) {
    if (this.has) {
      this.setFogChildren(this.has, init)
    }
    if (!this.children.find(c => c.label === LABEL_TYPES.fogOverlay)) {
      const overlay = new Sprite(getFogTexture())
      overlay.label = LABEL_TYPES.fogOverlay
      overlay.anchor.set(_DAX / _DW, _DAY / _DH)
      overlay.eventMode = 'none'
      this.addChild(overlay)
    }
    // This cell goes fog: remove its dither ring, update visible neighbors
    this._updateEdgeDither()
    const { grid } = this.context.map
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        if (di === 0 && dj === 0) continue
        grid[this.i + di]?.[this.j + dj]?._updateEdgeDither()
      }
    }
    for (const corpse of this.corpses) {
      this.setFogChildren(corpse, init)
    }
  }

  removeFog() {
    const {
      context: { controls },
    } = this
    function setRemoveChildren(instance) {
      if (controls.instanceInCamera(instance)) {
        instance.visible = true
      }
      for (let i = 0; i < instance.children.length; i++) {
        if (instance.children[i].tint) {
          instance.children[i].tint = COLOR_WHITE
        }
      }
    }
    if (!this.visible) {
      this.visible = true
    }
    this.zIndex = 0
    for (let i = this.children.length - 1; i >= 0; i--) {
      if (this.children[i].label === LABEL_TYPES.fogOverlay) {
        this.removeChild(this.children[i])
      }
    }
    // This cell is now visible: check edge dither for self and neighbors
    this._updateEdgeDither()
    const { grid } = this.context.map
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        if (di === 0 && dj === 0) continue
        grid[this.i + di]?.[this.j + dj]?._updateEdgeDither()
      }
    }
    if (this.has) {
      this.removeFogBuilding(this.has)
      setRemoveChildren(this.has)
    }
    for (const corpse of this.corpses) {
      setRemoveChildren(corpse)
    }
  }
}