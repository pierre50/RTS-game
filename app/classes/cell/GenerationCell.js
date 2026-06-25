import { Assets } from 'pixi.js'
import { cartesianToIsometric, updateInstanceRenderVisibility } from '../../lib'
import { CELL_DEPTH, FAMILY_TYPES, LABEL_TYPES } from '../../constants'
import { CellFog } from './CellFog'

const textureIndexForCell = (i, j, assets = []) => (assets.length ? (i * 31 + j * 17) % assets.length : 0)

export class GenerationCell {
  constructor(options, context) {
    this.context = context
    this.map = context.map
    this.family = FAMILY_TYPES.cell
    this.i = options.i
    this.j = options.j
    this.z = options.z ?? 0
    this.type = options.type
    this.solid = false
    this.visible = false
    this.inclined = false
    this.border = false
    this.waterBorder = false
    this.viewed = false
    this.viewBy = new Set()
    this.has = null
    this.corpses = new Set()
    this.fogSprites = []
    this.children = []
    this.terrainSet = null
    this._hasFog = false
    this._fogChunks = null
    this._terrainAppearance = { desertBorders: null, deepWaterBorders: null, relief: null, waterBorder: null }

    const definition = options.definition || Assets.cache.get('config').cells[this.type]
    this.category = definition.category
    this.color = definition.color
    this.assets = definition.assets
    this.terrainTextureName = options.textureName || this.assets[textureIndexForCell(this.i, this.j, this.assets)]
    const [x, y] = cartesianToIsometric(this.i, this.j)
    this.x = x
    this.y = y - this.z * CELL_DEPTH
    this.zIndex = this.i + this.j
    this.cellFog = new CellFog(this)
    this.isGenerationCell = true
  }

  _updateChild(instance) {
    updateInstanceRenderVisibility(instance)
  }

  updateVisible() {
    const { map, player } = this.context
    if (!player?.views) return
    if (!map.revealEverything && !player.views.isViewed(this.i, this.j)) return
    this.visible = true
    if (this.has) this._updateChild(this.has)
    for (const corpse of this.corpses) this._updateChild(corpse)
  }

  place(entity) {
    this.has = entity
    this.updateVisible()
  }

  addChild(child) {
    if (!this.children.includes(child)) this.children.push(child)
    return child
  }

  removeChild(child) {
    const index = this.children.indexOf(child)
    if (index >= 0) this.children.splice(index, 1)
    return child
  }

  getChildByLabel(label) {
    return this.children.find(child => child.label === label) || null
  }

  resetTerrainAppearance({ preserveWaterBorder = false } = {}) {
    const [x, y] = cartesianToIsometric(this.i, this.j)
    this.x = x
    this.y = y - this.z * CELL_DEPTH
    this.inclined = false
    if (!preserveWaterBorder) {
      this.border = false
      this.waterBorder = false
    }
    this._terrainAppearance.desertBorders = null
    this._terrainAppearance.deepWaterBorders = null
    this._terrainAppearance.relief = null
    if (!preserveWaterBorder) this._terrainAppearance.waterBorder = null
  }

  setDeepWaterBorder(direction) {
    if (!this._terrainAppearance.deepWaterBorders) this._terrainAppearance.deepWaterBorders = new Set()
    this._terrainAppearance.deepWaterBorders.add(direction)
  }

  setTerrainType(type) {
    const definition = Assets.cache.get('config').cells[type]
    if (!definition) return
    const wasWater = this.category === 'Water'
    this.type = type
    Object.assign(this, definition)
    this.terrainTextureName = this.map.randomItem(this.assets)
    if (wasWater !== (this.category === 'Water')) this.map.invalidateReliefCoastDistances()
  }

  setWater() {
    this.setTerrainType('Water')
  }

  setWaterBorder(resourceName, index) {
    this.border = true
    this.waterBorder = true
    this._terrainAppearance.waterBorder = { resourceName, index }
    if (this.has && typeof this.has.die === 'function') this.has.die(true)
  }

  setReliefBorder(index, elevation = 0) {
    this._terrainAppearance.relief = { index, elevation }
    if (elevation) this.y -= elevation
    this.inclined = true
  }

  setDesertBorder(direction) {
    if (!this._terrainAppearance.desertBorders) this._terrainAppearance.desertBorders = new Set()
    this._terrainAppearance.desertBorders.add(direction)
  }

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

  getTerrainDecorations() {
    return this.children.filter(child => child.label === LABEL_TYPES.floor || child.label === LABEL_TYPES.set)
  }
}
