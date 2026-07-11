import type { Texture } from 'pixi.js'
import { Assets, Container, Sprite } from 'pixi.js'
import { BUILDING_TYPES, COLOR_GREEN, COLOR_RED, LABEL_TYPES } from '../constants'
import { getBuildingAsset, getTexture, changeSpriteColor, canPlaceBuildingAt } from '../lib'
import { getWallTexture } from '../lib/buildings/walls'
import type { PlaceableBuildingConfig } from '../types/entities'
import type { RuntimeCell, RuntimeMap } from '../types/map'
import type { PlacementOwner } from '../types/player'
import type { RecolorableSprite } from '../lib'

type EditorPreviewKind = 'building' | 'unit' | 'animal'

type EditorPlacementSelection = {
  owner: PlacementOwner
  type: string
  kind: EditorPreviewKind
}

export type EditorPreviewControls = Container & {
  context: {
    map: RuntimeMap
    editor: {
      hasWallDraft?: () => boolean
      _canWallUseCell: (cell: RuntimeCell, owner: PlacementOwner | null) => boolean
    }
  }
  camera: { x: number; y: number }
}

type SpriteSheetLike = {
  textures: Record<string, Texture>
}

type UnitPreviewConfig = {
  category?: string
  allAssets?: {
    default?: {
      standingSheet?: string
    }
  }
  assets?: {
    standingSheet?: string
  }
}

export class EditorEntityPreview {
  controls: EditorPreviewControls
  container: Container | null
  _kind: EditorPreviewKind | null
  _type: string | null
  _owner: PlacementOwner | null
  _buildingConfig: PlaceableBuildingConfig | null
  _isBoat: boolean

  constructor(controls: EditorPreviewControls) {
    this.controls = controls
    this.container = null
    this._kind = null
    this._type = null
    this._owner = null
    this._buildingConfig = null
    this._isBoat = false
  }

  set(selection: EditorPlacementSelection | null): void {
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
    const buildingConfig = kind === 'building' ? owner.config?.buildings?.[type] : null
    this._buildingConfig = buildingConfig ? { ...buildingConfig, type } : null
    this._isBoat =
      kind === 'unit' && (owner.config?.units?.[type] as UnitPreviewConfig | undefined)?.category === 'Boat'
    this.controls.addChild(container)
  }

  clear(): void {
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

  update(cell: RuntimeCell | null): void {
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

    const sprite = this.container.getChildByLabel(LABEL_TYPES.sprite) as Sprite | null
    if (wallDraftActive) {
      this.container.visible = true
      if (sprite) sprite.visible = false
      return
    }

    this.container.visible = true
    if (sprite) sprite.visible = true

    const canPlace = this._canPlace(cell)
    const tint = canPlace ? COLOR_GREEN : COLOR_RED
    if (sprite) sprite.tint = tint
  }

  _canPlace(cell: RuntimeCell): boolean {
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
    if (this._isBoat) return Boolean(cell.category === 'Water' || cell.waterBorder)
    return Boolean(cell.category !== 'Water' && !cell.waterBorder && !cell.inclined)
  }

  _buildContainer(owner: PlacementOwner, type: string, kind: EditorPreviewKind): Container | null {
    try {
      if (kind === 'building') return this._buildBuildingContainer(owner, type)
      if (kind === 'unit') return this._buildUnitContainer(owner, type)
      if (kind === 'animal') return this._buildAnimalContainer(type)
    } catch {
      return null
    }
    return null
  }

  _buildBuildingContainer(owner: PlacementOwner, type: string): Container {
    if (type === BUILDING_TYPES.smallWall) {
      const container = new Container()
      const sprite = Sprite.from(getWallTexture(owner, 2))
      sprite.label = LABEL_TYPES.sprite
      container.addChild(sprite)
      return container
    }

    const assets = getBuildingAsset(type, owner, Assets)
    const texture = getTexture(assets.images?.final ?? '', Assets)
    const container = new Container()

    const sprite = Sprite.from(texture)
    sprite.label = LABEL_TYPES.sprite
    container.addChild(sprite)

    changeSpriteColor(sprite as RecolorableSprite, owner.color ?? '')

    return container
  }

  _buildUnitContainer(owner: PlacementOwner, type: string): Container | null {
    const unitConfig = owner.config?.units?.[type] as UnitPreviewConfig | undefined
    const sheetId = unitConfig?.allAssets?.default?.standingSheet || unitConfig?.assets?.standingSheet
    if (!sheetId) return null
    const texture = this._getFirstSheetFrame(sheetId)
    if (!texture) return null

    const container = new Container()
    const sprite = Sprite.from(texture)
    sprite.label = LABEL_TYPES.sprite
    changeSpriteColor(sprite as RecolorableSprite, owner.color ?? '')
    container.addChild(sprite)
    return container
  }

  _buildAnimalContainer(type: string): Container | null {
    const animalConfig = (
      Assets.cache.get('config') as { animals?: Record<string, { assets?: { standingSheet?: string } }> }
    )?.animals?.[type]
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

  _getFirstSheetFrame(sheetId: string): Texture | null {
    const sheet = Assets.cache.get(sheetId) as SpriteSheetLike | undefined
    if (!sheet?.textures) return null
    const firstName = Object.keys(sheet.textures).sort((a, b) => parseInt(a) - parseInt(b))[0]
    return firstName ? sheet.textures[firstName] : null
  }
}
