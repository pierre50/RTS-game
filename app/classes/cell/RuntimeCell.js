import { updateInstanceRenderVisibility } from '../../lib'
import { FAMILY_TYPES } from '../../constants'
import { CellFog } from './CellFog'

export class RuntimeCell {
  constructor(source) {
    this.context = source.context
    this.family = FAMILY_TYPES.cell
    this.map = source.map
    this.i = source.i
    this.j = source.j
    this.x = source.x
    this.y = source.y
    this.z = source.z
    this.zIndex = source.zIndex
    this.type = source.type
    this.category = source.category
    this.color = source.color
    this.assets = source.assets
    this.terrainTextureName = source.terrainTextureName
    this.solid = source.solid
    this.visible = source.visible
    this.inclined = source.inclined
    this.border = source.border
    this.waterBorder = source.waterBorder
    this.viewed = source.viewed
    this.viewBy = source.viewBy
    this.has = source.has
    this.corpses = source.corpses
    this.fogSprites = source.fogSprites
    this._hasFog = source._hasFog
    this._terrainAppearance = source._terrainAppearance
    this.terrainSet = source.terrainSet || null
    this._fogChunks = null
    this.cellFog = null
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

  getChildByLabel() {
    return null
  }

  removeChild() {}

  addChild(child) {
    this.context.map.fogLayer?.addChild(child)
    return child
  }

  _ensureCellFog() {
    if (!this.cellFog) this.cellFog = new CellFog(this)
    return this.cellFog
  }

  setFog(init) {
    return this._ensureCellFog().setFog(init)
  }

  removeFog() {
    return this._ensureCellFog().removeFog()
  }

  addFogBuilding(textureSheet, colorSheet, colorName) {
    return this._ensureCellFog().addFogBuilding(textureSheet, colorSheet, colorName)
  }

  removeFogBuilding(instance) {
    return this._ensureCellFog().removeFogBuilding(instance)
  }

  setFogChildren(instance, init) {
    return this._ensureCellFog().setFogChildren(instance, init)
  }
}
