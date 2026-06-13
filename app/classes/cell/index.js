import { Container, Assets, Sprite } from 'pixi.js'
import { cartesianToIsometric, playerCanSeeInstance } from '../../lib'
import { CELL_DEPTH, FAMILY_TYPES, LABEL_TYPES } from '../../constants'
import { CellFog } from './CellFog'
import { CellTerrain } from './CellTerrain'

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
    this._ditherKey = null
    this._hasFog = false

    Object.keys(options).forEach(prop => {
      this[prop] = options[prop]
    })
    Object.keys(Assets.cache.get('config').cells[this.type]).forEach(prop => {
      this[prop] = Assets.cache.get('config').cells[this.type][prop]
    })
    const pos = cartesianToIsometric(this.i, this.j)

    this.x = pos[0]
    this.y = pos[1] - this.z * CELL_DEPTH
    // Terrain tiles need an isometric draw order so taller relief variants are not hidden
    // behind neighboring cells that happened to be added later to the map container.
    this.zIndex = this.i + this.j
    this.sortableChildren = true

    const textureName = map.randomItem(this.assets)
    const resourceName = textureName.split('_')[1]
    const textureFile = textureName + '.png'
    const spritesheet = Assets.cache.get(resourceName)
    const texture = spritesheet.textures[textureFile]
    this.sprite = new Sprite(texture)
    this.sprite.zIndex = 0
    this.sprite.label = LABEL_TYPES.sprite
    this.sprite.anchor.set(
      Math.floor(texture.width / 2) / texture.width,
      Math.floor(texture.height / 2) / texture.height
    )
    this.sprite.roundPixels = true
    this.sprite.allowMove = false
    this.sprite.eventMode = 'none'
    this.sprite.allowClick = false
    this.addChild(this.sprite)

    this.cellFog = new CellFog(this)
    this.cellTerrain = new CellTerrain(this)

    // Replay fog building sprites for cells loaded from a save
    this.fogSprites.forEach(s => this.cellFog.addFogBuilding(...Object.values(s)))

    this.eventMode = 'none'
    this.allowMove = false
    this.allowClick = false
  }

  _updateChild(instance) {
    const { map, player } = this.context
    if (instance.family === FAMILY_TYPES.resource && !map.showResources) {
      instance.visible = false
      return
    }

    const isInPlayerSight = playerCanSeeInstance(instance, player)
    instance.visible =
      map.revealEverything ||
      instance.owner?.isPlayed ||
      isInPlayerSight ||
      instance.family === FAMILY_TYPES.resource ||
      (!map.revealTerrain && !instance.owner)
  }

  updateVisible() {
    const {
      context: { map, player },
    } = this
    if (!map.revealEverything && !player.views.isViewed(this.i, this.j)) {
      return
    }
    this.visible = true
    if (this.has) {
      this._updateChild(this.has)
    }
    for (const corpse of this.corpses) {
      this._updateChild(corpse)
    }
  }

  place(entity) {
    this.has = entity
    this.updateVisible()
  }

  releaseTerrainRenderResources() {
    if (this._terrainRenderResourcesReleased) return
    this._terrainRenderResourcesReleased = true
    for (const child of this.removeChildren()) {
      child.destroy?.({ children: true, texture: false, textureSource: false })
    }
    this.sprite = null
  }

  // Fog delegates
  setFog(init) {
    return this.cellFog.setFog(init)
  }
  removeFog() {
    return this.cellFog.removeFog()
  }
  addFogBuilding(textureSheet, colorSheet, colorName) {
    return this.cellFog.addFogBuilding(textureSheet, colorSheet, colorName)
  }
  removeFogBuilding(instance) {
    return this.cellFog.removeFogBuilding(instance)
  }
  setFogChildren(instance, init) {
    return this.cellFog.setFogChildren(instance, init)
  }
  _updateEdgeDither() {
    return this.cellFog._updateEdgeDither()
  }

  // Terrain delegates
  setDesertBorder(direction) {
    return this.cellTerrain.setDesertBorder(direction)
  }
  resetTerrainAppearance() {
    return this.cellTerrain.resetTerrainAppearance()
  }
  setTerrainType(type) {
    return this.cellTerrain.setTerrainType(type)
  }
  setWaterBorder(resourceName, index) {
    return this.cellTerrain.setWaterBorder(resourceName, index)
  }
  setReliefBorder(index, elevation) {
    return this.cellTerrain.setReliefBorder(index, elevation)
  }
  setWater() {
    return this.cellTerrain.setWater()
  }
  fillWaterCellsAroundCell() {
    return this.cellTerrain.fillWaterCellsAroundCell()
  }
  fillReliefCellsAroundCell() {
    return this.cellTerrain.fillReliefCellsAroundCell()
  }
  setCellLevel(level, cpt) {
    return this.cellTerrain.setCellLevel(level, cpt)
  }
}
