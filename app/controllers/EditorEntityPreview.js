import { Assets, Container, Sprite } from 'pixi.js'
import { BUILDING_TYPES, COLOR_FLASHY_GREEN, COLOR_RED, LABEL_TYPES } from '../constants'
import { getBuildingAsset, getTexture, changeSpriteColor, canPlaceBuildingAt } from '../lib'
import { getWallTexture } from '../lib/buildings/walls'

export class EditorEntityPreview {
  constructor(controls) {
    this.controls = controls
    this.container = null
    this._kind = null
    this._type = null
    this._owner = null
    this._buildingConfig = null
    this._isBoat = false
  }

  set(selection) {
    this.clear()
    if (!selection) return

    const { owner, type, kind } = selection
    const container = this._buildContainer(owner, type, kind)
    if (!container) return

    container.alpha = 0.8
    container.visible = false
    this.container = container
    this._kind = kind
    this._type = type
    this._owner = owner
    this._buildingConfig = kind === 'building' ? owner.config?.buildings?.[type] : null
    this._isBoat = kind === 'unit' && owner.config?.units?.[type]?.category === 'Boat'
    this.controls.addChild(container)
  }

  clear() {
    if (!this.container) return
    this.controls.removeChild(this.container)
    this.container.destroy({ children: true })
    this.container = null
    this._kind = null
    this._type = null
    this._owner = null
    this._buildingConfig = null
    this._isBoat = false
  }

  update(cell) {
    if (!this.container) return
    if (!cell) {
      this.container.visible = false
      return
    }

    const { controls } = this
    const isWall = this._type === BUILDING_TYPES.smallWall
    const wallDraftActive = isWall && controls.context.editor.hasWallDraft?.()

    this.container.x = cell.x - controls.camera.x
    this.container.y = cell.y - controls.camera.y

    const sprite = this.container.getChildByLabel(LABEL_TYPES.sprite)
    if (wallDraftActive) {
      this.container.visible = true
      if (sprite) sprite.visible = false
      return
    }

    this.container.visible = true
    if (sprite) sprite.visible = true

    const canPlace = this._canPlace(cell)
    const tint = canPlace ? COLOR_FLASHY_GREEN : COLOR_RED
    if (sprite) sprite.tint = tint
  }

  _canPlace(cell) {
    if (!cell) return false
    const {
      controls: {
        context: { map, editor },
      },
    } = this

    if (this._type === BUILDING_TYPES.smallWall) {
      return editor._canWallUseCell(cell, this._owner)
    }

    if (this._kind === 'building' && this._buildingConfig) {
      return canPlaceBuildingAt(map.grid, cell.i, cell.j, this._buildingConfig)
    }

    if (cell.has || cell.solid || cell.border) return false
    if (this._isBoat) return cell.category === 'Water' || cell.waterBorder
    return cell.category !== 'Water' && !cell.waterBorder && !cell.inclined
  }

  _buildContainer(owner, type, kind) {
    try {
      if (kind === 'building') return this._buildBuildingContainer(owner, type)
      if (kind === 'unit') return this._buildUnitContainer(owner, type)
      if (kind === 'animal') return this._buildAnimalContainer(type)
    } catch {
      return null
    }
    return null
  }

  _buildBuildingContainer(owner, type) {
    if (type === BUILDING_TYPES.smallWall) {
      const container = new Container()
      const sprite = Sprite.from(getWallTexture(owner, 2))
      sprite.label = LABEL_TYPES.sprite
      container.addChild(sprite)
      return container
    }

    const assets = getBuildingAsset(type, owner, Assets)
    const texture = getTexture(assets.images.final, Assets)
    const container = new Container()

    const sprite = Sprite.from(texture)
    sprite.label = LABEL_TYPES.sprite
    container.addChild(sprite)

    changeSpriteColor(sprite, owner.color)

    return container
  }

  _buildUnitContainer(owner, type) {
    const unitConfig = owner.config?.units?.[type]
    const sheetId = unitConfig?.allAssets?.default?.standingSheet || unitConfig?.assets?.standingSheet
    if (!sheetId) return null
    const texture = this._getFirstSheetFrame(sheetId)
    if (!texture) return null

    const container = new Container()
    const sprite = Sprite.from(texture)
    sprite.label = LABEL_TYPES.sprite
    changeSpriteColor(sprite, owner.color)
    container.addChild(sprite)
    return container
  }

  _buildAnimalContainer(type) {
    const animalConfig = Assets.cache.get('config')?.animals?.[type]
    const sheetId = animalConfig?.assets?.standingSheet
    if (!sheetId) return null
    const texture = this._getFirstSheetFrame(sheetId)
    if (!texture) return null

    const container = new Container()
    const sprite = Sprite.from(texture)
    sprite.label = LABEL_TYPES.sprite
    container.addChild(sprite)
    return container
  }

  _getFirstSheetFrame(sheetId) {
    const sheet = Assets.cache.get(sheetId)
    if (!sheet?.textures) return null
    const firstName = Object.keys(sheet.textures).sort((a, b) => parseInt(a) - parseInt(b))[0]
    return firstName ? sheet.textures[firstName] : null
  }
}
