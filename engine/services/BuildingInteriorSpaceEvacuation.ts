import { BUILDING_TYPES, FAMILY_TYPES, SHEET_TYPES } from '../../app/constants'
import { sameBuilding } from '../../app/lib/buildings/identity'
import { getBuildingInteriorEntryCell } from '../../app/lib/buildings/interiors'
import { clearUnitOverheadIndicator } from '../../app/lib/entities/overheadIndicator'
import { getCellsAroundPoint } from '../../app/lib/grid/cells'
import { updateInstanceRenderVisibility, updateInstanceVisibility } from '../../app/lib/grid/visibility'
import { HORSE_TAMING_STATUS } from '../../app/lib/horses/horseTaming'
import type { StableHorse } from '../../app/lib/horses/stableHorses'
import { getStableHorses } from '../../app/lib/horses/stableHorses'
import { getStableInteriorHorseIndex } from '../../app/lib/horses/stableInteriorHorseIdentity'
import { spookWildHorse } from '../../app/lib/horses/wildHorseBehavior'
import { getEntitySpaceId, getMapSpace, moveEntityToMapSpace, OUTSIDE_SPACE_ID } from '../../app/lib/mapSpaces'
import { prepareUnitForSpaceTransfer } from '../../app/services/SpacePortalSystem'
import type { GameContextLike } from '../../app/types/context'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../app/types/entities'
import type { RuntimeCell, RuntimeMapSpace } from '../../app/types/map'
import { getBuildingInteriorSpaceForBuilding } from './BuildingInteriorSpaceLookup'
import type { BuildingInteriorRuntimeSpace } from './BuildingInteriorSpaceTypes'
import { refreshMapSpaceEntityVisibility } from './BuildingInteriorSpaceVisibility'

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
    if (cells[0]) return cells[0] ?? null
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
    ...(horse.horseColor === undefined ? {} : { horseColor: horse.horseColor }),
    tamingStatus: HORSE_TAMING_STATUS.wild,
    ambientMovement: true,
    strategy: 'runaway',
  })
  releaseStableHorseEntity(entity)
  return entity
}

export function expelBuildingInteriorOccupants(context: GameContextLike, building: BuildingEntity): RuntimeEntity[] {
  const space = getBuildingInteriorSpaceForBuilding(context, building)
  const outsideSpace = getMapSpace(context.map, OUTSIDE_SPACE_ID)
  if (!outsideSpace) return []
  const anchor =
    space?.exteriorEntryCell ??
    getBuildingInteriorEntryCell(building, context.map.grid) ??
    context.map.grid[building.i]?.[building.j] ??
    null

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
    const assignedHorse =
      building.type === BUILDING_TYPES.stable && isHorseEntity(entity) && getStableInteriorHorseIndex(entity) !== null
    moveEntityToMapSpace(context.map, entity, outsideSpace, cell)
    if (assignedHorse) {
      releaseStableHorseEntity(entity)
      releasedStableHorses += 1
    }
    updateInstanceVisibility(entity)
    updateInstanceRenderVisibility(entity)
    claimedCells.add(evacuationCellKey(cell))
    expelled.push(entity)
  }

  releaseRemainingHorses(
    context,
    building,
    outsideSpace,
    anchor,
    stableHorseRecords.slice(releasedStableHorses),
    claimedCells,
    expelled
  )
  finishEvacuation(context, building, space)
  return expelled
}

function releaseRemainingHorses(
  context: GameContextLike,
  building: BuildingEntity,
  outsideSpace: RuntimeMapSpace,
  anchor: RuntimeCell | null,
  horses: StableHorse[],
  claimedCells: Set<string>,
  expelled: RuntimeEntity[]
): void {
  for (const [index, horse] of horses.entries()) {
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
}

function finishEvacuation(
  context: GameContextLike,
  building: BuildingEntity,
  space: BuildingInteriorRuntimeSpace | null
): void {
  if (building.type === BUILDING_TYPES.stable) {
    building.stableHorses = []
    building.horseAmount = 0
  }

  if (space && context.map.activeSpaceId === space.id) {
    context.map.activeSpaceId = null
    space.renderer.setActive(false)
    refreshMapSpaceEntityVisibility(context)
  }
}
