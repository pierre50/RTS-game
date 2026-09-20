import { ensureCaveMinerals } from './BuildingInteriorSpaceMinerals'
import { formatTerrainReliefCells } from '../../app/classes/map/terrain/MapTerrainReliefAppearance'
import { addInteriorWalls } from '../../app/lib/graphics/interiorWalls'
import type { ContainerChild } from 'pixi.js'
import { Cell } from '../../app/classes/cell'
import { createSquareLocalBlueprint } from '../../app/classes/map/generation/LocalMapBlueprint'
import type { MapBlueprint } from '../../app/classes/map/MapGeneration'
import { BUILDING_TYPES } from '../../app/constants'
import { getBuildingInteriorEntryCell } from '../../app/lib/buildings/interiors'
import { ensureMapSpaces, getMapSpace, OUTSIDE_SPACE_ID } from '../../app/lib/mapSpaces'
import { syncStableInteriorHorses } from '../../app/services/buildingInterior/StableInteriorHorses'
import type { GameContextLike } from '../../app/types/context'
import type { BuildingEntity } from '../../app/types/entities'
import type { RuntimeCell, RuntimeMapSpacePortal } from '../../app/types/map'
import { ensureInteriorDefaultBuildings } from './BuildingInteriorSpaceDecorations'
import {
  createDefaultBuildingInteriorBlueprint,
  isBlueprintExitCell,
  isInteriorFloorCell,
  maskValue,
  sortCellsForSleep,
} from './BuildingInteriorSpaceLayout'
import {
  getBuildingInteriorSpaceForBuilding,
  getBuildingInteriorSpaceId,
  isBuildingInteriorRuntimeSpace,
} from './BuildingInteriorSpaceLookup'
import {
  BuildingInteriorSpaceRenderer,
  createSpaceMapAdapter,
  placeRendererNearBuilding,
} from './BuildingInteriorSpaceRenderer'
import type { BuildingInteriorRuntimeSpace } from './BuildingInteriorSpaceTypes'
import { refreshMapSpaceEntityVisibility } from './BuildingInteriorSpaceVisibility'
export { expelBuildingInteriorOccupants } from './BuildingInteriorSpaceEvacuation'
export { extractBuildingInteriorChestInventory } from './BuildingInteriorSpaceInventory'
export { getBuildingInteriorSpaceForBuilding, getBuildingInteriorSpaceForUnit } from './BuildingInteriorSpaceLookup'
export { BuildingInteriorSpaceRenderer } from './BuildingInteriorSpaceRenderer'
export {
  moveHeroPartyIntoBuildingInteriorSpace,
  moveHeroPartyOutOfBuildingInteriorSpace,
  routeUnitIntoBuildingInteriorSpace,
  routeUnitIntoBuildingInteriorSpaceAndMoveBack,
  routeUnitOutOfBuildingInteriorSpace,
} from './BuildingInteriorSpaceRoutes'
export {
  moveUnitToBuildingInteriorSleep,
  settleUnitAtBuildingInteriorSleepCell,
  syncBuildingInteriorShelterOccupants,
} from './BuildingInteriorSpaceSleep'
export type { BuildingInteriorRuntimeSpace } from './BuildingInteriorSpaceTypes'
export {
  activateBuildingInteriorSpace,
  deactivateBuildingInteriorSpace,
  refreshMapSpaceEntityVisibility,
} from './BuildingInteriorSpaceVisibility'

export { applyBuildingInteriorIdleFacing } from '../../app/services/buildingInterior/InteriorIdleFacing'

export function syncBuildingStableInteriorHorses(context: GameContextLike, building: BuildingEntity): void {
  if (building.type !== BUILDING_TYPES.stable) return
  const space = getBuildingInteriorSpaceForBuilding(context, building)
  if (!space) return
  syncStableInteriorHorses(context, space)
  refreshMapSpaceEntityVisibility(context)
}

function buildInteriorSpaceCells(
  context: GameContextLike,
  blueprint: MapBlueprint,
  id: string,
  renderer: BuildingInteriorSpaceRenderer
): {
  exitCell: RuntimeCell | null
  grid: RuntimeCell[][]
  idleCells: RuntimeCell[]
  sleepCells: RuntimeCell[]
  walkableCells: RuntimeCell[]
} {
  const grid: RuntimeCell[][] = renderer.grid
  const adapter = createSpaceMapAdapter(context, grid, blueprint, renderer.entityLayer)
  const cellContext = { ...context, map: adapter } as unknown as GameContextLike
  const center = Math.round(blueprint.size / 2)
  const relief = blueprint.relief ?? []
  let exitCell: RuntimeCell | null = null
  const walkableCells: RuntimeCell[] = []

  for (let i = 0; i <= blueprint.size; i += 1) {
    const row: RuntimeCell[] = []
    grid[i] = row
    for (let j = 0; j <= blueprint.size; j += 1) {
      if (blueprint.terrain[i]?.[j] == null) continue
      const isFloor = maskValue(blueprint.floorMask, i, j) || !blueprint.floorMask
      const isExit = isBlueprintExitCell(blueprint, i, j)
      const cell = new Cell(
        {
          i,
          j,
          z: relief[i]?.[j] ?? 0,
          type: String(blueprint.terrain[i]?.[j] ?? 'Dirt'),
          terrainHidden: !isFloor,
          skipFog: true,
        },
        cellContext
      ) as RuntimeCell
      const cellView = cell as RuntimeCell &
        ContainerChild & { renderable?: boolean; sprite?: { renderable?: boolean } }
      cell.spaceId = id
      cell.visible = isFloor
      cellView.renderable = isFloor
      cell.zIndex = i + j - 0.2
      cell.border = maskValue(blueprint.borderMask, i, j) && !isExit
      cell.waterBorder = false
      cell.solid = !isFloor
      if (cellView.sprite) cellView.sprite.renderable = isFloor && cell.category !== 'Water'
      row[j] = cell
      if (isFloor) renderer.terrainLayer.addChild(cellView)
      if (isExit && isFloor) exitCell = cell
      if (isInteriorFloorCell(cell)) walkableCells.push(cell)
    }
  }

  formatTerrainReliefCells({ size: blueprint.size, grid })
  addInteriorWalls(blueprint, renderer.entityLayer)

  if (!exitCell) exitCell = grid[center]?.[center] ?? walkableCells[0] ?? null
  const idleCells = sortCellsForSleep(
    walkableCells.filter(cell => cell !== exitCell),
    exitCell,
    center
  )
  return {
    exitCell,
    grid,
    idleCells,
    sleepCells: idleCells,
    walkableCells,
  }
}

export function ensureBuildingInteriorSpace(
  context: GameContextLike,
  building: BuildingEntity,
  blueprintData: MapBlueprint
): BuildingInteriorRuntimeSpace {
  const blueprint = createSquareLocalBlueprint(blueprintData)
  const map = context.map
  const id = getBuildingInteriorSpaceId(building)
  const existing = getMapSpace(map, id)
  if (isBuildingInteriorRuntimeSpace(existing)) {
    syncStableInteriorHorses(context, existing)
    return existing
  }

  ensureMapSpaces(map)
  const grid: RuntimeCell[][] = []
  const renderer = new BuildingInteriorSpaceRenderer(context, id, grid, blueprint.size)
  const built = buildInteriorSpaceCells(context, blueprint, id, renderer)
  placeRendererNearBuilding(renderer, building, built.exitCell)
  const exteriorEntryCell = getBuildingInteriorEntryCell(building, map.grid)
  const entryPortal: RuntimeMapSpacePortal = {
    id: `${id}:entry`,
    sourceSpaceId: OUTSIDE_SPACE_ID,
    sourceCell: exteriorEntryCell,
    targetSpaceId: id,
    targetCell: built.exitCell,
  }
  const exitPortal: RuntimeMapSpacePortal = {
    id: `${id}:exit`,
    sourceSpaceId: id,
    sourceCell: built.exitCell,
    targetSpaceId: OUTSIDE_SPACE_ID,
    targetCell: exteriorEntryCell,
  }
  const space: BuildingInteriorRuntimeSpace = {
    id,
    kind: 'interior',
    grid: built.grid,
    size: blueprint.size,
    ...(blueprint.localGridLayout === undefined ? {} : { localGridLayout: blueprint.localGridLayout }),
    container: renderer.entityLayer,
    shadowLayer: renderer.shadowLayer,
    shadowRenderContainer: renderer.sceneLayer,
    origin: { x: renderer.x, y: renderer.y },
    mapType: 'interior',
    building,
    buildingLabel: building.label,
    entryCell: built.exitCell,
    exitCell: built.exitCell,
    entryPortal,
    exteriorEntryCell,
    exitPortal,
    idleCells: built.idleCells,
    instanceBuckets: null,
    portals: [entryPortal, exitPortal],
    renderer,
    sleepCells: built.sleepCells,
    walkableCells: built.walkableCells,
  }
  renderer.space = space
  map.spaces?.set(id, space)
  map.addChild(renderer)
  ensureInteriorDefaultBuildings(context, space)
  ensureCaveMinerals(context, space, blueprint)
  syncStableInteriorHorses(context, space)
  return space
}

export function ensureRuntimeBuildingInteriorSpace(
  context: GameContextLike,
  building: BuildingEntity
): BuildingInteriorRuntimeSpace | null {
  const existing = getBuildingInteriorSpaceForBuilding(context, building)
  if (existing) return existing
  if (!building.isBuilt || building.isDead || building.isDestroyed) return null
  return ensureBuildingInteriorSpace(context, building, createDefaultBuildingInteriorBlueprint(building))
}
