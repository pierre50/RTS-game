import { ownerSharesVision } from '../../lib/units/playerVisionAccess'
import { Assets, Polygon, Sprite } from 'pixi.js'
import { FAMILY_TYPES, LABEL_TYPES, PASSABLE_RESOURCE_TYPES } from '../../constants'
import {
  attachEntityShadowsToMapSpace,
  cartesianToIsometric,
  clearCellTerrainSet,
  getBuildingAsset,
  getBuildingAssetOwner,
  getEntityMapSpace,
  getBuildingFootprintCells,
  getBuildingTextureNameWithSize,
  getGroundReliefLevel,
  getInstanceZIndex,
  getReliefLiftPixels,
  getTexture,
  STABLE_HORSE_CAPACITY,
  HORSE_TAMING_STATUS,
  textureRefToString,
  updateInstanceVisibility,
} from '../../lib'
import { applyBuildingConstructionGhost } from './BuildingVisuals'
import { BuildingTrainingPreview } from './BuildingTrainingPreview'
import type { Building, BuildingOptions } from './Building'
import type { HorseTamingStatus } from '../../lib/horses/horseTaming'
import type { RuntimeCell } from '../../types/map'
import type { Texture } from 'pixi.js'

type BuildingTexture = Texture & { hitArea?: number[] }

function getInitialBuildingTextureRef(building: Building) {
  if (!building.isBuilt) {
    return getBuildingAsset(building.assetType || building.type, getBuildingAssetOwner(building), Assets).images?.final
  }
  return getBuildingTextureNameWithSize(building.size)
}

export function stableHorsesFromOptions(
  options: BuildingOptions
): Array<{ horseColor?: string; tamingStatus?: HorseTamingStatus }> {
  if (Array.isArray(options.stableHorses)) {
    return options.stableHorses.map(horse => ({
      ...horse,
      tamingStatus: HORSE_TAMING_STATUS.tamed,
    }))
  }
  const horseAmount = Math.max(0, Math.min(STABLE_HORSE_CAPACITY, Number(options.horseAmount) || 0))
  return Array.from({ length: horseAmount }, () => ({ tamingStatus: HORSE_TAMING_STATUS.tamed }))
}

export function resumeInitialBuildingWork(building: Building): void {
  if (building.queue.length) {
    building.buyUnit(building.queue[0], true, true)
    return
  }
}

export function setupBuildingTransform(building: Building): void {
  const { map, controls } = building.context
  const space = getEntityMapSpace(building, map)
  const grid = space?.grid ?? map.grid
  const anchorCell = grid[building.i]?.[building.j]
  if (!anchorCell) throw new Error(`Cannot spawn building on missing cell (${building.i}, ${building.j})`)
  const [flatX, flatY] = cartesianToIsometric(building.i, building.j)
  building.x = flatX
  building.y = flatY
  building.z = anchorCell.z
  building.zIndex = getInstanceZIndex(building)
  building.reliefLift = -getReliefLiftPixels(getGroundReliefLevel(anchorCell))
  building.visible = map.revealEverything && controls.instanceInCamera(building)
}

export function createInitialBuildingSprite(building: Building): void {
  const spriteSheet = getInitialBuildingTextureRef(building) ?? getBuildingTextureNameWithSize(building.size)
  building.textureName = textureRefToString(spriteSheet!)
  const texture = getTexture(spriteSheet!, Assets) as BuildingTexture
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
    const assets = getBuildingAsset(building.assetType || building.type, getBuildingAssetOwner(building), Assets)
    building.sprite.scale.x = Boolean(assets.mirrored) !== Boolean(building.placementMirrored) ? -1 : 1
    applyBuildingConstructionGhost(building)
  }
  building.shadow = building.createShadow()
}

export function occupyBuildingFootprint(building: Building): void {
  const { map, player } = building.context
  const space = getEntityMapSpace(building, map)
  const grid = space?.grid ?? map.grid
  const updatesOutsideWorldVision = space?.kind !== 'interior'
  const providesOutsideWorldVision =
    updatesOutsideWorldVision &&
    building.providesVision !== false &&
    ownerSharesVision(building.owner, building.context)
  getBuildingFootprintCells(building.i, building.j, grid, building.size, (cell: RuntimeCell) => {
    if (cell.has?.family === FAMILY_TYPES.resource && PASSABLE_RESOURCE_TYPES.has(cell.has.type)) {
      cell.has.die?.(true)
    }
    clearCellTerrainSet(cell)
    for (const corpse of cell.corpses) {
      typeof corpse.clear === 'function' && corpse.clear()
    }
    cell.has = building
    cell.solid = true
    if (providesOutsideWorldVision) {
      building.owner.views.addViewer(cell.i, cell.j, building)
      if (building.owner.views.setViewed(cell.i, cell.j)) {
        building.owner.cellViewed++
      }
      cell.viewBy = new Set(player.views.getViewers(cell.i, cell.j))
      if (player.views.hasViewer(cell.i, cell.j, building) && !map.revealEverything) {
        cell.removeFog()
      }
    } else if (updatesOutsideWorldVision) {
      cell.viewBy = new Set(player.views.getViewers(cell.i, cell.j))
      cell.updateVisible()
    }
    return true
  })
}

export function attachInitialBuildingVisuals(building: Building): void {
  building.sprite.eventMode = 'static'
  building.sprite.roundPixels = true
  building.bindSpriteInteractions()
  attachEntityShadowsToMapSpace(building.context.map, building)
  building.addChild(building.sprite)
  if (!building.isBuilt) applyBuildingConstructionGhost(building)
  building.buildingTrainingPreview = new BuildingTrainingPreview(building)
  building.buildingTrainingPreview.update()
  if (building.shouldKeepHealthBarVisible()) building.drawHealthBar()
  if (building.shouldKeepHealthBarVisible()) building.drawEnergyBar()
}

export function activateBuiltBuilding(building: Building): void {
  if (!building.isBuilt) return
  building.visibilityTimeout = setTimeout(() => {
    updateInstanceVisibility(building)
    building.scanForInitialTarget()
  })
  building.finalTexture()
  building.onBuilt()
}
