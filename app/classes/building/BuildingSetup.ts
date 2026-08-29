import { Assets, Polygon, Sprite } from 'pixi.js'
import { LABEL_TYPES } from '../../constants'
import {
  attachEntityShadowsToMapSpace,
  cartesianToIsometric,
  clearCellTerrainSet,
  getEntityMapSpace,
  getBuildingFootprintCells,
  getBuildingTextureNameWithSize,
  getGroundReliefLevel,
  getInstanceZIndex,
  getReliefLiftPixels,
  getTexture,
  STABLE_HORSE_CAPACITY,
  textureRefToString,
  updateInstanceVisibility,
} from '../../lib'
import { BuildingTrainingPreview } from './BuildingTrainingPreview'
import type { Building, BuildingOptions } from './Building'
import type { RuntimeCell } from '../../types/map'
import type { Texture } from 'pixi.js'

type BuildingTexture = Texture & { hitArea?: number[] }

export function stableHorsesFromOptions(options: BuildingOptions): Array<{ horseColor?: string }> {
  if (Array.isArray(options.stableHorses)) return [...options.stableHorses]
  const horseAmount = Math.max(0, Math.min(STABLE_HORSE_CAPACITY, Number(options.horseAmount) || 0))
  return Array.from({ length: horseAmount }, () => ({}))
}

export function resumeInitialBuildingWork(building: Building): void {
  if (building.queue.length) {
    building.buyUnit(building.queue[0], true, true)
    return
  }
  const queuedTechnology = building.technology
  if (queuedTechnology) building.buyTechnology(queuedTechnology.type, true, true)
}

export function setupBuildingTransform(building: Building): void {
  const { map, controls } = building.context
  const space = getEntityMapSpace(building, map)
  const grid = space?.grid ?? map.grid
  const anchorCell = grid[building.i][building.j]
  const [flatX, flatY] = cartesianToIsometric(building.i, building.j)
  building.x = flatX
  building.y = flatY
  building.z = anchorCell.z
  building.zIndex = getInstanceZIndex(building)
  building.reliefLift = -getReliefLiftPixels(getGroundReliefLevel(anchorCell))
  building.visible = map.revealEverything && controls.instanceInCamera(building)
}

export function createInitialBuildingSprite(building: Building): void {
  const spriteSheet = getBuildingTextureNameWithSize(building.size)
  building.textureName = textureRefToString(spriteSheet!)
  const texture = getTexture(spriteSheet!, Assets) as BuildingTexture
  building.sprite = Sprite.from(texture)
  const interactiveSprite = building.sprite as Sprite & { updateAnchor?: boolean }
  interactiveSprite.updateAnchor = true
  building.sprite.label = LABEL_TYPES.sprite
  building.sprite.hitArea = texture.hitArea
    ? new Polygon(texture.hitArea)
    : new Polygon([-32 * building.size, 0, 0, -16 * building.size, 32 * building.size, 0, 0, 16 * building.size])
  building.sprite.position.y = building.reliefLift ?? 0
  building.shadow = building.createShadow()
}

export function occupyBuildingFootprint(building: Building): void {
  const { map, player } = building.context
  const space = getEntityMapSpace(building, map)
  const grid = space?.grid ?? map.grid
  const updatesWorldVision = space?.kind !== 'interior'
  getBuildingFootprintCells(building.i, building.j, grid, building.size, (cell: RuntimeCell) => {
    clearCellTerrainSet(cell)
    for (const corpse of cell.corpses) {
      typeof corpse.clear === 'function' && corpse.clear()
    }
    cell.has = building
    cell.solid = true
    if (updatesWorldVision) {
      building.owner.views.addViewer(cell.i, cell.j, building)
      if (building.owner.views.setViewed(cell.i, cell.j)) {
        building.owner.cellViewed++
      }
      cell.viewBy = new Set(player.views.getViewers(cell.i, cell.j))
      if (player.views.hasViewer(cell.i, cell.j, building) && !map.revealEverything) {
        cell.removeFog()
      }
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

export function restoreBuildingRallyPoint(building: Building, options: BuildingOptions): void {
  const rallyPoint = options.rallyPoint as { i: number; j: number; direction: number } | undefined
  if (!rallyPoint) return
  const space = getEntityMapSpace(building, building.context.map)
  const grid = space?.grid ?? building.context.map.grid
  building.setRallyPoint(grid[rallyPoint.i]?.[rallyPoint.j], rallyPoint.direction)
}
