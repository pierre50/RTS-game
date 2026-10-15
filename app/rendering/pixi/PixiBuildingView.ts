import { Assets, Container, Polygon, Sprite, type Texture } from 'pixi.js'
import { constructionProgressPercentage } from '../../lib/economy/constructionMaterials'
import { assignCampBrazierAppearance } from '../../lib/buildings/campConstruction'
import { LABEL_TYPES } from '../../constants'
import {
  attachEntityShadowsToMapSpace,
  getBuildingAsset,
  getBuildingAssetOwner,
  getTexture,
  textureRefToString,
} from '../../lib'
import {
  applyBuildingConstructionGhost,
  createBuildingShadow,
  destroyBuildingVisuals,
  getBuildingShadowTexture,
  syncBuildingConstructionReveal,
  syncBuildingVisualSettings,
  updateBuildingShadow,
  type BuildingShadow,
} from './PixiBuildingVisuals'
import { BuildingTrainingPreview } from './PixiBuildingTrainingPreview'
import { applyBuildingFinalTexture } from './PixiBuildingFinalTexture'
import { showBuildingDestruction } from './PixiBuildingDestruction'
import type { Building } from '../../classes/building/Building'
import type { BuildingDestructionGroundTarget, BuildingViewAdapter, BuildingVisualState } from '../BuildingView'
import {
  drawInstanceEnergyBar,
  drawInstanceHealthBar,
  drawInstanceHeroPowerBar,
  removeInstanceHudBar,
} from './PixiEntityHudBars'

type BuildingTexture = Texture & { hitArea?: number[] }

/** Owns initial Pixi visuals and applies the renderer-neutral building transform. */
export class PixiBuildingView implements BuildingViewAdapter {
  readonly container = new Container()

  constructor(private readonly building: Building) {
    this.container.label = building.label
    Object.assign(this.container, { runtimeEntity: building })
  }

  mount(state: BuildingVisualState): void {
    const building = this.building
    Object.assign(this.container, { family: building.family, spaceId: building.spaceId })
    this.container.eventMode = 'static'
    building.x = state.position.x
    building.y = state.position.y
    building.z = state.position.z
    building.zIndex = state.sortOrder
    building.reliefLift = state.reliefLift
    building.visible = state.visible
  }

  createInitialSprite(): void {
    const building = this.building
    assignCampBrazierAppearance(building)
    const assets = getBuildingAsset(building.assetType || building.type, getBuildingAssetOwner(building), Assets)
    const spriteSheet = assets.images?.final
    if (!spriteSheet) throw new Error(`Missing final texture for building: ${building.assetType || building.type}`)
    building.textureName = textureRefToString(spriteSheet)
    const texture = getTexture(spriteSheet, Assets) as BuildingTexture
    building.sprite = Sprite.from(texture)
    const interactiveSprite = building.sprite as Sprite & { updateAnchor?: boolean }
    interactiveSprite.updateAnchor = true
    building.sprite.label = LABEL_TYPES.sprite
    building.sprite.hitArea = texture.hitArea
      ? new Polygon(texture.hitArea)
      : new Polygon([-32 * building.size, 0, 0, -16 * building.size, 32 * building.size, 0, 0, 16 * building.size])
    if (texture.defaultAnchor) building.sprite.anchor.set(texture.defaultAnchor.x, texture.defaultAnchor.y)
    building.sprite.position.y = building.reliefLift ?? 0
    if (!building.isBuilt) {
      building.sprite.scale.x = Boolean(assets.mirrored) !== Boolean(building.placementMirrored) ? -1 : 1
      applyBuildingConstructionGhost(building)
    }
    building.shadow = building.createShadow()
  }

  attachInitialVisuals(): void {
    const building = this.building
    building.sprite.eventMode = 'static'
    building.sprite.roundPixels = true
    building.bindSpriteInteractions()
    attachEntityShadowsToMapSpace(building.context.map, building)
    this.container.addChild(building.sprite)
    if (!building.isBuilt) syncBuildingConstructionReveal(building, constructionProgressPercentage(building))
    building.buildingTrainingPreview = new BuildingTrainingPreview(building, this.container)
    building.buildingTrainingPreview.update()
    if (building.shouldKeepHealthBarVisible()) building.drawHealthBar()
    if (building.shouldKeepHealthBarVisible()) building.drawEnergyBar()
  }

  getShadowTexture(): Texture | null { return getBuildingShadowTexture(this.building) }
  createShadow(): BuildingShadow | null { return createBuildingShadow(this.building) }
  updateShadow(shadow: BuildingShadow | null): void { updateBuildingShadow(this.building, shadow) }
  syncVisualSettings(): void { syncBuildingVisualSettings(this.building) }
  applyFinalTexture(): void { applyBuildingFinalTexture(this.building) }
  showDestruction(groundTargets: BuildingDestructionGroundTarget[]): void {
    showBuildingDestruction(this.building, this.container, groundTargets)
  }
  drawHealthBar(): void { drawInstanceHealthBar(this.building) }
  drawEnergyBar(): void { drawInstanceEnergyBar(this.building) }
  drawHeroPowerBar(ratio: number): void { drawInstanceHeroPowerBar(this.building, ratio) }
  removeHealthBar(): void { removeInstanceHudBar(this.building, LABEL_TYPES.healthBar) }
  removeEnergyBar(): void { removeInstanceHudBar(this.building, LABEL_TYPES.energyBar) }
  removeHeroPowerBar(): void { removeInstanceHudBar(this.building, LABEL_TYPES.powerBar) }
  destroy(): void {
    destroyBuildingVisuals(this.building)
    this.container.parent?.removeChild(this.container)
  }
}
