import { Container, Graphics, type ContainerChild } from 'pixi.js'
import { Cell } from '../classes/cell'
import { BUILDING_TYPES, CELL_HEIGHT, CELL_WIDTH, FAMILY_TYPES, LABEL_TYPES, SHEET_TYPES } from '../constants'
import { sameBuilding } from '../lib/buildings/identity'
import {
  findInteriorDecorationCell,
  getBuildingInteriorDecorationLayout,
  interiorCellKey,
} from '../lib/buildings/interiorDecorations'
import { getBuildingInteriorEntryCell, getBuildingInteriorPortalId } from '../lib/buildings/interiors'
import { getCellsAroundPoint } from '../lib/grid/cells'
import { canPlaceBuildingAt } from '../lib/grid/placement'
import { updateInstanceRenderVisibility, updateInstanceVisibility } from '../lib/grid/visibility'
import {
  OUTSIDE_SPACE_ID,
  ensureMapSpaces,
  getEntityMapSpace,
  getEntitySpaceId,
  getMapSpace,
  moveEntityToMapSpace,
  sameMapSpace,
} from '../lib/mapSpaces'
import {
  INTERACTION_CELL_MARKER_PULSE_MS,
  drawInteractionCellMarker,
  interactionCellPulse,
} from '../lib/ui/InteractionCellMarker'
import { clearUnitOverheadIndicator, setUnitOverheadIndicator } from '../lib/entities/overheadIndicator'
import { shouldVillagerBeAsleep } from '../lib/units/villagerSchedule'
import {
  canUnitUseCellAsIdleDestination,
  createReservedPassageCellLookup,
  isRuntimeMapSpacePassageCell,
  type ReservedPassageCellLookup,
} from '../lib/buildings/passageCells'
import { setDetachedShadowsVisible, setSleepingOutsideFinalVisual } from './rest/UnitSleepVisuals'
import { HORSE_TAMING_STATUS } from '../lib/horses/horseTaming'
import { spookWildHorse } from '../lib/horses/wildHorseBehavior'
import { getStableHorses, type StableHorse } from '../lib/horses/stableHorses'
import {
  prepareUnitForSpaceTransfer,
  routeUnitThroughSpacePortal,
  transferUnitThroughSpacePortal,
  type SpacePortalRouteOptions,
} from './SpacePortalSystem'
import { syncStableInteriorHorses } from './buildingInterior/StableInteriorHorses'
import type { GameContextLike } from '../types/context'
import type { ResourceAmount } from '../types/common'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell, RuntimeMap, RuntimeMapSpace, RuntimeMapSpacePortal } from '../types/map'
import type { MapBlueprint } from '../classes/map/MapGeneration'

type TickerLike = { deltaMS?: number; elapsedMS?: number }
type BuildingInventory = NonNullable<BuildingEntity['inventory']>
type InteriorSpaceMapAdapter = Pick<
  RuntimeMap,
  | 'grid'
  | 'size'
  | 'seed'
  | 'mapType'
  | 'revealEverything'
  | 'revealTerrain'
  | 'instantMode'
  | 'startingResources'
  | 'resources'
  | 'random'
  | 'randomRange'
  | 'randomItem'
  | 'invalidateReliefCoastDistances'
  | 'setCoordinate'
  | 'updateRenderChunks'
  | 'addToInstanceBucket'
  | 'removeFromInstanceBucket'
  | 'updateInstanceBucket'
  | 'addChild'
  | 'removeChild'
> & {
  invalidateWaterOverlay?: () => void
}

export type BuildingInteriorRuntimeSpace = RuntimeMapSpace & {
  building: BuildingEntity
  defaultBuildingsPlaced?: boolean
  entryPortal: RuntimeMapSpacePortal
  exteriorEntryCell: RuntimeCell | null
  exitPortal: RuntimeMapSpacePortal
  renderer: BuildingInteriorSpaceRenderer
  sleepCells: RuntimeCell[]
}

const TARGET_FRAME_MS = 1000 / 60
const INTERIOR_RENDER_Z_INDEX = 1_000_000_001
const INTERIOR_BACKDROP_Z_INDEX = -2
const INTERIOR_SCENE_LAYER_Z_INDEX = 0
const INTERIOR_TERRAIN_LAYER_Z_INDEX = -0.5
const INTERIOR_ENTITY_LAYER_Z_INDEX = 1
const BACKDROP_ALPHA = 1
const DEFAULT_INTERIOR_SIZE_BY_TYPE: Record<string, number> = {
  [BUILDING_TYPES.townCenter]: 15,
  [BUILDING_TYPES.watchTower]: 11,
}

function maskValue(mask: MapBlueprint['floorMask'], i: number, j: number): boolean {
  return mask?.[i]?.[j] === 1
}

function isBlueprintExitCell(blueprint: MapBlueprint, i: number, j: number): boolean {
  return Boolean(blueprint.exits?.some(exit => exit?.i === i && exit?.j === j))
}

function createDefaultBuildingInteriorBlueprint(building: BuildingEntity): MapBlueprint {
  const size = DEFAULT_INTERIOR_SIZE_BY_TYPE[building.type] ?? 13
  const width = size + 1
  const center = size / 2
  const radius = Math.max(4, Math.floor(width * 0.31))
  const terrain = Array.from({ length: width }, () => Array.from({ length: width }, () => 'Water'))
  const relief = Array.from({ length: width }, () => Array.from({ length: width }, () => 0))
  const floorMask = Array.from({ length: width }, () => Array.from({ length: width }, () => 0))
  const borderMask = Array.from({ length: width }, () => Array.from({ length: width }, () => 0))

  for (let i = 0; i <= size; i += 1) {
    for (let j = 0; j <= size; j += 1) {
      if (Math.hypot(i - center, j - center) > radius) continue
      terrain[i][j] = 'Dirt'
      floorMask[i][j] = 1
    }
  }

  for (let i = 0; i <= size; i += 1) {
    for (let j = 0; j <= size; j += 1) {
      if (!floorMask[i][j]) continue
      let touchesOutside = false
      for (let di = -1; di <= 1 && !touchesOutside; di += 1) {
        for (let dj = -1; dj <= 1; dj += 1) {
          if (di === 0 && dj === 0) continue
          const ni = i + di
          const nj = j + dj
          if (ni < 0 || nj < 0 || ni > size || nj > size || !floorMask[ni][nj]) {
            touchesOutside = true
            break
          }
        }
      }
      if (touchesOutside) borderMask[i][j] = 1
    }
  }

  const exit = {
    i: Math.round(center),
    j: Math.min(size - 1, Math.round(center + radius * 0.76)),
  }
  borderMask[exit.i][exit.j] = 0

  return {
    seed: building.context?.map?.seed,
    kind: 'interior',
    mapType: 'interior',
    interiorType: building.type,
    size,
    terrain,
    relief,
    floorMask,
    borderMask,
    spawns: [{ i: exit.i, j: exit.j }],
    exits: [exit],
    resources: [],
  }
}

function isInteriorFloorCell(cell: RuntimeCell | null | undefined): cell is RuntimeCell {
  return Boolean(cell && !cell.terrainHidden && !cell.border && !cell.waterBorder && cell.category !== 'Water')
}

function isCellAvailableForUnit(
  space: RuntimeMapSpace,
  cell: RuntimeCell | null | undefined,
  unit: UnitEntity,
  passageLookup: ReservedPassageCellLookup
): cell is RuntimeCell {
  if (isRuntimeMapSpacePassageCell(space, cell)) return false
  if (!isInteriorFloorCell(cell)) return false
  return canUnitUseCellAsIdleDestination(unit, cell, { passageLookup })
}

function findFreeCellNear(
  space: RuntimeMapSpace,
  preferred: RuntimeCell | null | undefined,
  unit: UnitEntity,
  passageLookup: ReservedPassageCellLookup
): RuntimeCell | null {
  if (isCellAvailableForUnit(space, preferred, unit, passageLookup)) return preferred
  const anchor =
    preferred ??
    space.entryCell ??
    space.exitCell ??
    space.grid[Math.round(space.size / 2)]?.[Math.round(space.size / 2)]
  if (!anchor) return null
  for (let radius = 1; radius <= Math.max(2, space.size); radius += 1) {
    const cells = getCellsAroundPoint(anchor.i, anchor.j, space.grid, radius, cell =>
      isCellAvailableForUnit(space, cell, unit, passageLookup)
    )
    if (cells.length) return cells[0]
  }
  return null
}

function findSleepCell(space: BuildingInteriorRuntimeSpace, unit: UnitEntity): RuntimeCell | null {
  const passageLookup = createReservedPassageCellLookup(unit.context)
  for (const cell of space.sleepCells) {
    if (isCellAvailableForUnit(space, cell, unit, passageLookup)) return cell
  }
  return findFreeCellNear(space, space.entryCell, unit, passageLookup)
}

function evacuationCellKey(cell: RuntimeCell): string {
  return `${cell.spaceId ?? OUTSIDE_SPACE_ID}:${cell.i}:${cell.j}`
}

function canUseExteriorEvacuationCell(
  cell: RuntimeCell | null | undefined,
  entity: RuntimeEntity,
  claimedCells: Set<string>
): boolean {
  if (!cell || claimedCells.has(evacuationCellKey(cell))) return false
  if (cell.terrainHidden || cell.border || cell.waterBorder || cell.category === 'Water') return false
  const occupant = cell.has
  return Boolean(!cell.solid || occupant === entity || occupant?.label === entity.label || occupant?.isDestroyed)
}

function findExteriorEvacuationCell(
  context: GameContextLike,
  anchor: RuntimeCell | null,
  searchSize: number,
  entity: RuntimeEntity,
  claimedCells: Set<string>
): RuntimeCell | null {
  const outsideSpace = getMapSpace(context.map, OUTSIDE_SPACE_ID)
  const exteriorGrid = outsideSpace?.grid ?? context.map.grid
  if (canUseExteriorEvacuationCell(anchor, entity, claimedCells)) return anchor
  if (!anchor) return null

  for (let radius = 1; radius <= Math.max(2, searchSize, 8); radius += 1) {
    const cells = getCellsAroundPoint(anchor.i, anchor.j, exteriorGrid, radius, cell =>
      canUseExteriorEvacuationCell(cell, entity, claimedCells)
    )
    if (cells.length) return cells[0]
  }
  return null
}

function collectBuildingInteriorOccupants(
  context: GameContextLike,
  building: BuildingEntity,
  space: BuildingInteriorRuntimeSpace | null
): RuntimeEntity[] {
  const occupants = new Set<RuntimeEntity>()
  for (const column of space?.instanceBuckets ?? []) {
    for (const bucket of column) {
      for (const entity of bucket) {
        if (entity.isDead || entity.isDestroyed) continue
        if (entity.family === FAMILY_TYPES.unit || entity.family === FAMILY_TYPES.animal) occupants.add(entity)
      }
    }
  }
  for (const player of context.players ?? []) {
    for (const unit of player.units ?? []) {
      if (unit.isDead || unit.isDestroyed) continue
      if ((space && getEntitySpaceId(unit) === space.id) || sameBuilding(unit.shelterState?.shelter, building)) {
        occupants.add(unit)
      }
    }
  }
  for (const animal of context.map.gaia?.animals ?? []) {
    if (animal.isDead || animal.isDestroyed) continue
    if (space && getEntitySpaceId(animal) === space.id) occupants.add(animal)
  }
  return [...occupants]
}

function restoreUnitAfterBuildingExpulsion(unit: UnitEntity): void {
  unit.shelterState = null
  unit.suspendedRestState = null
  clearUnitOverheadIndicator(unit)
  unit.setTextures?.(SHEET_TYPES.standing)
  unit.syncAppearanceLayers?.(SHEET_TYPES.standing)
  unit.sprite?.stop?.()
}

function isHorseEntity(entity: RuntimeEntity): boolean {
  return entity.family === FAMILY_TYPES.animal && entity.type === 'Horse'
}

function releaseStableHorseEntity(entity: RuntimeEntity): void {
  Object.assign(entity, {
    ambientMovement: true,
    strategy: 'runaway',
    tamingStatus: HORSE_TAMING_STATUS.wild,
  })
  spookWildHorse(entity)
  entity.updateTexture?.()
}

function createReleasedStableHorse(
  context: GameContextLike,
  horse: StableHorse,
  outsideSpace: RuntimeMapSpace,
  cell: RuntimeCell
): RuntimeEntity | null {
  const createAnimal = context.map.gaia?.createAnimal
  if (typeof createAnimal !== 'function') return null
  const entity = createAnimal.call(context.map.gaia, {
    i: cell.i,
    j: cell.j,
    spaceId: outsideSpace.id,
    type: 'Horse',
    horseColor: horse.horseColor,
    tamingStatus: HORSE_TAMING_STATUS.wild,
    ambientMovement: true,
    strategy: 'runaway',
  })
  releaseStableHorseEntity(entity)
  return entity
}

function mergeInventoryResources(target: BuildingInventory, resources: ResourceAmount | null | undefined): void {
  if (!resources) return
  for (const [resource, amount] of Object.entries(resources)) {
    if (!amount || amount <= 0) continue
    target.resources = target.resources ?? {}
    target.resources[resource as keyof ResourceAmount] = (target.resources[resource as keyof ResourceAmount] ?? 0) + amount
  }
}

function mergeInventoryEquipment(target: BuildingInventory, equipment: string[] | null | undefined): void {
  if (!equipment?.length) return
  target.equipment = [...(target.equipment ?? []), ...equipment]
}

function mergeBuildingInventory(target: BuildingInventory, source: BuildingInventory | null | undefined): void {
  mergeInventoryResources(target, source?.resources)
  mergeInventoryEquipment(target, source?.equipment)
}

function hasInventoryContent(inventory: BuildingInventory): boolean {
  return Boolean(
    Object.values(inventory.resources ?? {}).some(amount => (amount ?? 0) > 0) || (inventory.equipment?.length ?? 0) > 0
  )
}

function clearBuildingInventory(inventory: BuildingInventory | null | undefined): void {
  if (!inventory) return
  inventory.resources = {}
  inventory.equipment = []
}

function removeInteriorChest(context: GameContextLike, chest: BuildingEntity): void {
  if (chest.currentCell?.has === chest) {
    chest.currentCell.has = null
    chest.currentCell.solid = false
  }
  context.map.removeFromInstanceBucket?.(chest)
  const buildings = chest.owner?.buildings
  const index = buildings?.indexOf(chest) ?? -1
  if (index >= 0) buildings?.splice(index, 1)
  chest.isDead = true
  chest.isDestroyed = true
  ;(chest as { parent?: { removeChild?: (child: BuildingEntity) => void } }).parent?.removeChild?.(chest)
  chest.destroy?.({ children: true, texture: false })
}

function buildingHasConfiguredInteriorChest(building: BuildingEntity): boolean {
  return getBuildingInteriorDecorationLayout(building, { includeFireCamp: false }).some(
    item => item.type === BUILDING_TYPES.chest
  )
}

function sortCellsForSleep(cells: RuntimeCell[], exitCell: RuntimeCell | null, center: number): RuntimeCell[] {
  return [...cells].sort((a, b) => {
    const aExit = exitCell ? Math.abs(a.i - exitCell.i) + Math.abs(a.j - exitCell.j) : 0
    const bExit = exitCell ? Math.abs(b.i - exitCell.i) + Math.abs(b.j - exitCell.j) : 0
    const aCenter = Math.abs(a.i - center) + Math.abs(a.j - center)
    const bCenter = Math.abs(b.i - center) + Math.abs(b.j - center)
    return bExit * 100 + bCenter - (aExit * 100 + aCenter)
  })
}

function findInteriorDefaultBuildingCell(
  context: GameContextLike,
  space: BuildingInteriorRuntimeSpace,
  type: string,
  preferred: { i: number; j: number },
  blockedCells: Set<string>,
  options: { allowBorderPlacement?: boolean } = {}
): RuntimeCell | null {
  const config = space.building.owner?.config?.buildings?.[type]
  if (!config) return null
  const placementConfig = { ...config, type }
  const placementSize = Number(config.size ?? 1)
  const canUseCell = (cell: RuntimeCell | null | undefined): cell is RuntimeCell => {
    if (!cell) return false
    if (!options.allowBorderPlacement) return canPlaceBuildingAt(space.grid, cell.i, cell.j, placementConfig)
    if (Math.floor(placementSize) !== 1) return canPlaceBuildingAt(space.grid, cell.i, cell.j, placementConfig)
    return (
      cell.category !== 'Water' &&
      !cell.waterBorder &&
      !cell.solid &&
      !cell.inclined &&
      !cell.has &&
      (cell.border || canPlaceBuildingAt(space.grid, cell.i, cell.j, placementConfig))
    )
  }

  return findInteriorDecorationCell(
    { grid: space.grid, randomItem: context.map.randomItem.bind(context.map), size: space.size },
    preferred,
    { blockedCells, canUseCell }
  )
}

function getInteriorDefaultBuildingPreferredCell(
  space: BuildingInteriorRuntimeSpace,
  item: ReturnType<typeof getBuildingInteriorDecorationLayout>[number],
  center: number
): { i: number; j: number } {
  if (item.placement === 'oppositeExitBorder' && space.exitCell) {
    const directionI = Math.sign(center - space.exitCell.i)
    const directionJ = Math.sign(center - space.exitCell.j)
    if (directionI === 0 && directionJ === 0) return { i: center + item.offsetI, j: center + item.offsetJ }
    let i = center
    let j = center
    let borderCell: RuntimeCell | null = null
    while (i >= 0 && i <= space.size && j >= 0 && j <= space.size) {
      const cell = space.grid[i]?.[j]
      if (cell?.border) borderCell = cell
      i += directionI
      j += directionJ
    }
    if (borderCell) return borderCell
  }
  return { i: center + item.offsetI, j: center + item.offsetJ }
}

function ensureInteriorDefaultBuildings(context: GameContextLike, space: BuildingInteriorRuntimeSpace): void {
  if (space.defaultBuildingsPlaced) return
  if (space.building.type === BUILDING_TYPES.stable) {
    space.defaultBuildingsPlaced = true
    return
  }
  const owner = space.building.owner
  if (!owner?.createBuilding) return
  const center = Math.round(space.size / 2)
  const blockedCells = new Set<string>()
  if (space.entryCell) blockedCells.add(interiorCellKey(space.entryCell))

  for (const item of getBuildingInteriorDecorationLayout(space.building)) {
    const label = `${space.id}:default:${item.key}`
    if (owner.buildings.some(building => building.label === label && !building.isDestroyed)) continue
    const preferred = getInteriorDefaultBuildingPreferredCell(space, item, center)
    const cell = findInteriorDefaultBuildingCell(context, space, item.type, preferred, blockedCells, {
      allowBorderPlacement: item.allowBorderPlacement,
    })
    if (!cell) continue
    const buildingOptions = { ...item.buildingOptions }
    const pendingResources = item.key === 'storage-chest' ? (space.building.inventory?.resources ?? {}) : null
    if (pendingResources != null) {
      buildingOptions.inventory = {
        ...(buildingOptions.inventory ?? {}),
        resources: { ...pendingResources },
      }
    }
    const defaultBuilding = owner.createBuilding({
      ...buildingOptions,
      i: cell.i,
      j: cell.j,
      label,
      spaceId: space.id,
      type: item.type,
      isBuilt: true,
      skipBuiltEffects: true,
    })
    if (defaultBuilding && pendingResources != null) {
      space.building.inventory = space.building.inventory ?? {}
      space.building.inventory.resources = {}
    }
    blockedCells.add(interiorCellKey(cell))
  }
  space.defaultBuildingsPlaced = true
}

export function syncBuildingStableInteriorHorses(context: GameContextLike, building: BuildingEntity): void {
  if (building.type !== BUILDING_TYPES.stable) return
  const space = getBuildingInteriorSpaceForBuilding(context, building)
  if (!space) return
  syncStableInteriorHorses(context, space)
  refreshMapSpaceEntityVisibility(context)
}

export function refreshMapSpaceEntityVisibility(context: GameContextLike): void {
  const refreshed = new Set<object>()
  for (const space of context.map.spaces?.values?.() ?? []) {
    for (const column of space.instanceBuckets ?? []) {
      for (const bucket of column) {
        for (const entity of bucket) {
          if (refreshed.has(entity)) continue
          refreshed.add(entity)
          updateInstanceVisibility(entity)
          updateInstanceRenderVisibility(entity)
        }
      }
    }
    ;(space.container as Container & { sortChildren?: () => void }).sortChildren?.()
  }
}

function createSpaceMapAdapter(
  context: GameContextLike,
  grid: RuntimeCell[][],
  blueprint: MapBlueprint,
  container: Container
): InteriorSpaceMapAdapter {
  const sourceMap = context.map
  return {
    grid,
    size: blueprint.size,
    seed: blueprint.seed,
    mapType: 'interior',
    revealEverything: true,
    revealTerrain: true,
    instantMode: true,
    startingResources: sourceMap.startingResources,
    resources: new Set(),
    random: () => sourceMap.random(),
    randomRange: (min: number, max: number) => sourceMap.randomRange(min, max),
    randomItem: <T>(items: T[]) => sourceMap.randomItem(items),
    invalidateReliefCoastDistances: () => {},
    invalidateWaterOverlay: () => {},
    setCoordinate: () => {},
    updateRenderChunks: () => {},
    addToInstanceBucket: entity => sourceMap.addToInstanceBucket(entity),
    removeFromInstanceBucket: entity => sourceMap.removeFromInstanceBucket(entity),
    updateInstanceBucket: (entity, oldI, oldJ) => sourceMap.updateInstanceBucket(entity, oldI, oldJ),
    addChild: <U extends ContainerChild[]>(...children: U): U[0] => container.addChild(...children),
    removeChild: <T extends ContainerChild>(child: T): T => {
      container.removeChild(child)
      return child
    },
  }
}

export class BuildingInteriorSpaceRenderer extends Container {
  backdrop: Graphics
  context: GameContextLike
  entityLayer: Container
  elapsedMs: number
  exitMarker: Graphics
  grid: RuntimeCell[][]
  mapType: 'interior'
  sceneLayer: Container
  shadowLayer: Container
  size: number
  space: BuildingInteriorRuntimeSpace | null
  spaceId: string
  terrainLayer: Container
  _onTick: (ticker: TickerLike) => void

  constructor(context: GameContextLike, id: string, grid: RuntimeCell[][], size: number) {
    super()
    this.context = context
    this.elapsedMs = 0
    this.grid = grid
    this.mapType = 'interior'
    this.size = size
    this.space = null
    this.spaceId = id
    this.label = 'building-interior-space'
    this.eventMode = 'none'
    this.sortableChildren = true
    this.zIndex = INTERIOR_RENDER_Z_INDEX

    this.backdrop = new Graphics()
    this.backdrop.eventMode = 'none'
    this.backdrop.label = 'building-interior-backdrop'
    this.backdrop.zIndex = INTERIOR_BACKDROP_Z_INDEX
    this.sceneLayer = new Container()
    this.sceneLayer.eventMode = 'auto'
    this.sceneLayer.label = 'building-interior-scene'
    this.sceneLayer.sortableChildren = true
    this.sceneLayer.zIndex = INTERIOR_SCENE_LAYER_Z_INDEX
    this.shadowLayer = new Container()
    this.shadowLayer.eventMode = 'none'
    this.shadowLayer.label = 'building-interior-shadow-source'
    this.shadowLayer.sortableChildren = true
    this.terrainLayer = new Container()
    this.terrainLayer.eventMode = 'none'
    this.terrainLayer.label = 'building-interior-terrain'
    this.terrainLayer.sortableChildren = true
    this.terrainLayer.zIndex = INTERIOR_TERRAIN_LAYER_Z_INDEX
    this.entityLayer = new Container()
    this.entityLayer.eventMode = 'auto'
    this.entityLayer.label = 'building-interior-entities'
    this.entityLayer.sortableChildren = true
    this.entityLayer.zIndex = INTERIOR_ENTITY_LAYER_Z_INDEX
    this.exitMarker = new Graphics()
    this.exitMarker.eventMode = 'none'
    this.exitMarker.label = LABEL_TYPES.interiorExit
    this.addChild(this.backdrop, this.sceneLayer)
    this.sceneLayer.addChild(this.terrainLayer, this.entityLayer)
    this.entityLayer.addChild(this.exitMarker)

    this._onTick = ticker => this.update(ticker.deltaMS ?? ticker.elapsedMS ?? TARGET_FRAME_MS)
    context.app.ticker.add(this._onTick)
    this.setActive(false)
  }

  setActive(active: boolean): void {
    this.visible = active
    this.renderable = active
  }

  update(deltaMs: number): void {
    if (!this.visible || !this.space) return
    this.updateBackdrop()
    this.updateExitMarker(deltaMs)
  }

  updateBackdrop(): void {
    const viewport = this.context.controls?.getViewportMetrics?.()
    if (!viewport) return
    const padding = Math.max(CELL_WIDTH * 4, 256)
    this.backdrop.clear()
    this.backdrop
      .rect(
        viewport.visibleLeft - this.x - padding,
        viewport.visibleTop - this.y - padding,
        viewport.visibleWidth + padding * 2,
        viewport.visibleHeight + padding * 2
      )
      .fill({ color: 0x050608, alpha: BACKDROP_ALPHA })
  }

  updateExitMarker(deltaMs: number): void {
    this.exitMarker.clear()
    const cell = this.space?.exitCell
    if (!cell) return
    this.elapsedMs = (this.elapsedMs + deltaMs) % INTERACTION_CELL_MARKER_PULSE_MS
    this.exitMarker.zIndex = (cell.zIndex ?? cell.i + cell.j) + 0.05
    drawInteractionCellMarker(this.exitMarker, cell, interactionCellPulse(this.elapsedMs))
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.context.app.ticker.remove(this._onTick)
    this.parent?.removeChild(this)
    this.shadowLayer.destroy({ children: true, texture: false, textureSource: false })
    super.destroy(options ?? { children: true, texture: false, textureSource: false })
  }
}

function getBuildingInteriorSpaceId(building: BuildingEntity): string {
  return `interior:${getBuildingInteriorPortalId(building)}`
}

function isBuildingInteriorRuntimeSpace(
  space: RuntimeMapSpace | null | undefined
): space is BuildingInteriorRuntimeSpace {
  return Boolean(space && space.kind === 'interior' && 'renderer' in space)
}

function buildInteriorSpaceCells(
  context: GameContextLike,
  blueprint: MapBlueprint,
  id: string,
  renderer: BuildingInteriorSpaceRenderer
): {
  exitCell: RuntimeCell | null
  grid: RuntimeCell[][]
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

  if (!exitCell) exitCell = grid[center]?.[center] ?? walkableCells[0] ?? null
  return {
    exitCell,
    grid,
    sleepCells: sortCellsForSleep(
      walkableCells.filter(cell => cell !== exitCell),
      exitCell,
      center
    ),
    walkableCells,
  }
}

function placeRendererNearBuilding(
  renderer: BuildingInteriorSpaceRenderer,
  building: BuildingEntity,
  exitCell: RuntimeCell | null
): void {
  const anchor = {
    x: building.x,
    y: building.y - CELL_HEIGHT,
  }
  renderer.x = anchor.x - (exitCell?.x ?? 0)
  renderer.y = anchor.y - (exitCell?.y ?? 0)
}

export function ensureBuildingInteriorSpace(
  context: GameContextLike,
  building: BuildingEntity,
  blueprint: MapBlueprint
): BuildingInteriorRuntimeSpace {
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
    instanceBuckets: null,
    portals: [entryPortal, exitPortal],
    renderer,
    sleepCells: built.sleepCells,
  }
  renderer.space = space
  map.spaces?.set(id, space)
  map.addChild(renderer)
  ensureInteriorDefaultBuildings(context, space)
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

export function getBuildingInteriorSpaceForBuilding(
  context: GameContextLike,
  building: BuildingEntity
): BuildingInteriorRuntimeSpace | null {
  const space = getMapSpace(context.map, getBuildingInteriorSpaceId(building))
  return isBuildingInteriorRuntimeSpace(space) ? space : null
}

export function extractBuildingInteriorChestInventory(
  context: GameContextLike,
  building: BuildingEntity
): BuildingInventory | null {
  const space = getBuildingInteriorSpaceForBuilding(context, building)
  const interiorChests = space
    ? [...(building.owner?.buildings ?? [])].filter(chest => {
        if (chest.type !== BUILDING_TYPES.chest) return false
        if (chest.isDead || chest.isDestroyed) return false
        return getEntitySpaceId(chest) === space.id
      })
    : []
  if (!buildingHasConfiguredInteriorChest(building) && interiorChests.length === 0) return null

  const merged: BuildingInventory = {}
  mergeBuildingInventory(merged, building.inventory)
  clearBuildingInventory(building.inventory)

  for (const chest of interiorChests) {
    mergeBuildingInventory(merged, chest.inventory)
    clearBuildingInventory(chest.inventory)
    removeInteriorChest(context, chest)
  }

  return hasInventoryContent(merged) ? merged : null
}

export function activateBuildingInteriorSpace(context: GameContextLike, space: BuildingInteriorRuntimeSpace): void {
  const map = context.map
  for (const candidate of map.spaces?.values?.() ?? []) {
    if (isBuildingInteriorRuntimeSpace(candidate)) candidate.renderer.setActive(candidate.id === space.id)
  }
  map.activeSpaceId = space.id
  space.renderer.setActive(true)
  space.renderer.update(0)
  refreshMapSpaceEntityVisibility(context)
}

export function deactivateBuildingInteriorSpace(context: GameContextLike, space: BuildingInteriorRuntimeSpace): void {
  const map = context.map
  if (map.activeSpaceId === space.id) map.activeSpaceId = null
  space.renderer.setActive(false)
  refreshMapSpaceEntityVisibility(context)
}

export function moveUnitToBuildingInteriorSleep(
  context: GameContextLike,
  unit: UnitEntity,
  space: BuildingInteriorRuntimeSpace,
  options: { mode?: 'instant' | 'route'; sleep?: boolean } = {}
): boolean {
  const state = unit.shelterState
  if (state?.reason !== 'sleep' || !sameBuilding(state.shelter, space.building)) return false
  const cell = findSleepCell(space, unit)
  if (!cell) return false
  if ((options.mode ?? 'instant') === 'route') {
    if (!transferUnitThroughSpacePortal(context, unit, space.entryPortal)) return false
    unit.shelterState = {
      ...state,
      status: 'movingToRest',
      location: 'shelter',
      shelter: space.building,
      targetCell: cell,
      startedAtMs: context.scheduler?.elapsedMs ?? 0,
      retryCount: 0,
    }
    unit.inactif = true
    setDetachedShadowsVisible(unit, true)
    if (unit.i === cell.i && unit.j === cell.j) {
      settleUnitAtBuildingInteriorSleepCell(unit, space, cell, { sleep: options.sleep })
    } else {
      unit.sendToEvt?.(cell, null, { forceRepath: true, preserveAutonomy: true })
    }
    return true
  }
  prepareUnitForSpaceTransfer(unit)
  moveEntityToMapSpace(context.map, unit, space, cell)
  settleUnitAtBuildingInteriorSleepCell(unit, space, cell, { sleep: options.sleep })
  return true
}

export function settleUnitAtBuildingInteriorSleepCell(
  unit: UnitEntity,
  space: BuildingInteriorRuntimeSpace,
  cell: RuntimeCell | null | undefined = unit.currentCell,
  options: { sleep?: boolean } = {}
): void {
  const state = unit.shelterState
  unit.shelterState = {
    ...state,
    status: 'inside',
    location: 'shelter',
    shelter: space.building,
    targetCell: cell,
  }
  unit.actionLocked = true
  unit.inactif = true
  setDetachedShadowsVisible(unit, true)
  const sleeping = options.sleep ?? shouldVillagerBeAsleep(unit)
  if (sleeping) {
    setSleepingOutsideFinalVisual(unit)
    setUnitOverheadIndicator(unit, 'sleep')
  } else {
    clearUnitOverheadIndicator(unit)
    unit.setTextures?.(SHEET_TYPES.standing)
    unit.syncAppearanceLayers?.(SHEET_TYPES.standing)
    unit.sprite?.stop?.()
  }
}

export function syncBuildingInteriorShelterOccupants(
  context: GameContextLike,
  space: BuildingInteriorRuntimeSpace
): void {
  for (const unit of space.building.owner?.units ?? []) {
    if (unit.isDead || unit.isDestroyed || unit === context.controls?.heroUnit) continue
    const state = unit.shelterState
    if (state?.status !== 'inside' || state.reason !== 'sleep' || !sameBuilding(state.shelter, space.building)) {
      continue
    }
    moveUnitToBuildingInteriorSleep(context, unit, space)
  }
}

export function expelBuildingInteriorOccupants(context: GameContextLike, building: BuildingEntity): RuntimeEntity[] {
  const space = getBuildingInteriorSpaceForBuilding(context, building)
  const outsideSpace = getMapSpace(context.map, OUTSIDE_SPACE_ID)
  if (!outsideSpace) return []
  const anchor =
    space?.exteriorEntryCell ?? getBuildingInteriorEntryCell(building, context.map.grid) ?? context.map.grid[building.i]?.[building.j] ?? null

  const claimedCells = new Set<string>()
  const expelled: RuntimeEntity[] = []
  const stableHorseRecords = building.type === BUILDING_TYPES.stable ? [...getStableHorses(building)] : []
  let releasedStableHorses = 0
  for (const entity of collectBuildingInteriorOccupants(context, building, space)) {
    const cell = findExteriorEvacuationCell(context, anchor, building.size ?? 1, entity, claimedCells)
    if (!cell) continue
    if (entity.family === FAMILY_TYPES.unit) {
      prepareUnitForSpaceTransfer(entity as UnitEntity)
      restoreUnitAfterBuildingExpulsion(entity as UnitEntity)
    } else {
      entity.stopInterval?.()
      entity.stopTimeout?.()
    }
    moveEntityToMapSpace(context.map, entity, outsideSpace, cell)
    if (building.type === BUILDING_TYPES.stable && isHorseEntity(entity)) {
      releaseStableHorseEntity(entity)
      releasedStableHorses += 1
    }
    updateInstanceVisibility(entity)
    updateInstanceRenderVisibility(entity)
    claimedCells.add(evacuationCellKey(cell))
    expelled.push(entity)
  }

  for (const [index, horse] of stableHorseRecords.slice(releasedStableHorses).entries()) {
    const probe = {
      family: FAMILY_TYPES.animal,
      isDestroyed: false,
      label: `${building.label}:released-stable-horse:${index}`,
      type: 'Horse',
    } as RuntimeEntity
    const cell = findExteriorEvacuationCell(context, anchor, building.size ?? 1, probe, claimedCells)
    if (!cell) continue
    const entity = createReleasedStableHorse(context, horse, outsideSpace, cell)
    if (!entity) continue
    updateInstanceVisibility(entity)
    updateInstanceRenderVisibility(entity)
    claimedCells.add(evacuationCellKey(cell))
    expelled.push(entity)
  }

  if (building.type === BUILDING_TYPES.stable) {
    building.stableHorses = []
    building.horseAmount = 0
  }

  if (space && context.map.activeSpaceId === space.id) {
    context.map.activeSpaceId = null
    space.renderer.setActive(false)
    refreshMapSpaceEntityVisibility(context)
  }
  return expelled
}

function moveUnitIntoBuildingInteriorSpace(
  context: GameContextLike,
  unit: UnitEntity,
  space: BuildingInteriorRuntimeSpace
): boolean {
  return transferUnitThroughSpacePortal(context, unit, space.entryPortal)
}

export function routeUnitIntoBuildingInteriorSpace(
  context: GameContextLike,
  unit: UnitEntity,
  space: BuildingInteriorRuntimeSpace
): boolean {
  return routeUnitThroughSpacePortal(context, unit, space.entryPortal)
}

function moveUnitOutOfBuildingInteriorSpace(
  context: GameContextLike,
  unit: UnitEntity,
  space: BuildingInteriorRuntimeSpace
): boolean {
  return transferUnitThroughSpacePortal(context, unit, space.exitPortal)
}

export function routeUnitOutOfBuildingInteriorSpace(
  context: GameContextLike,
  unit: UnitEntity,
  space: BuildingInteriorRuntimeSpace | null = getBuildingInteriorSpaceForUnit(unit),
  options: SpacePortalRouteOptions = {}
): boolean {
  if (!space || unit.isDead || unit.isDestroyed) return false
  return routeUnitThroughSpacePortal(context, unit, space.exitPortal, options)
}

export function getBuildingInteriorSpaceForUnit(unit: UnitEntity): BuildingInteriorRuntimeSpace | null {
  const space = getEntityMapSpace(unit)
  return isBuildingInteriorRuntimeSpace(space) ? space : null
}

function getUnitsFollowingInSameSpace(hero: UnitEntity): UnitEntity[] {
  return (hero.owner?.units ?? []).filter(
    unit => unit !== hero && unit.followingHero && !unit.isDead && !unit.isDestroyed && sameMapSpace(hero, unit)
  )
}

export function moveHeroPartyIntoBuildingInteriorSpace(
  context: GameContextLike,
  hero: UnitEntity,
  space: BuildingInteriorRuntimeSpace
): boolean {
  const followers = getUnitsFollowingInSameSpace(hero)
  if (!moveUnitIntoBuildingInteriorSpace(context, hero, space)) return false
  for (const follower of followers) routeUnitIntoBuildingInteriorSpace(context, follower, space)
  return true
}

export function moveHeroPartyOutOfBuildingInteriorSpace(
  context: GameContextLike,
  hero: UnitEntity,
  space: BuildingInteriorRuntimeSpace
): boolean {
  const followers = getUnitsFollowingInSameSpace(hero)
  if (!moveUnitOutOfBuildingInteriorSpace(context, hero, space)) return false
  for (const follower of followers) routeUnitOutOfBuildingInteriorSpace(context, follower, space)
  deactivateBuildingInteriorSpace(context, space)
  context.controls?.updateVisibleCells?.()
  return true
}
