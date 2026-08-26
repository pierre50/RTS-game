import { BUILDING_TYPES } from '../../constants'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import { angleDelta, getInstanceDegree } from '../maths'

const TOWN_CENTER_DOOR_OFFSET_X = 0
const TOWN_CENTER_DOOR_OFFSET_Y = 48
const TOWN_CENTER_DOOR_RADIUS_X = 48
const TOWN_CENTER_DOOR_RADIUS_Y = 38
const TOWN_CENTER_DOOR_FACING_OFFSET_X = 0
const TOWN_CENTER_DOOR_FACING_OFFSET_Y = 0
const TOWN_CENTER_DOOR_HALF_ANGLE = 70

type BuildingInteriorDoorConfig = {
  facingHalfAngle?: number
  facingOffsetX?: number
  facingOffsetY?: number
  offsetX?: number
  offsetY?: number
  radius?: number
  radiusX?: number
  radiusY?: number
}

type BuildingWithInteriorConfig = BuildingEntity & {
  interior?: {
    door?: BuildingInteriorDoorConfig
    type?: string
  }
}

function doorConfigForBuilding(building: BuildingWithInteriorConfig): Required<BuildingInteriorDoorConfig> | null {
  if (building.type !== BUILDING_TYPES.townCenter || !building.isBuilt) return null
  const configured = building.interior?.door ?? {}
  const radius = configured.radius ?? 0
  return {
    offsetX: configured.offsetX ?? TOWN_CENTER_DOOR_OFFSET_X,
    offsetY: configured.offsetY ?? TOWN_CENTER_DOOR_OFFSET_Y,
    radius,
    radiusX: configured.radiusX ?? (radius || TOWN_CENTER_DOOR_RADIUS_X),
    radiusY: configured.radiusY ?? (radius || TOWN_CENTER_DOOR_RADIUS_Y),
    facingOffsetX: configured.facingOffsetX ?? TOWN_CENTER_DOOR_FACING_OFFSET_X,
    facingOffsetY: configured.facingOffsetY ?? TOWN_CENTER_DOOR_FACING_OFFSET_Y,
    facingHalfAngle: configured.facingHalfAngle ?? TOWN_CENTER_DOOR_HALF_ANGLE,
  }
}

function isHeroInDoorZone(hero: UnitEntity, building: BuildingWithInteriorConfig): boolean {
  const door = doorConfigForBuilding(building)
  if (!door) return false
  const x = building.x + door.offsetX
  const y = building.y + door.offsetY
  const normalizedX = (hero.x - x) / door.radiusX
  const normalizedY = (hero.y - y) / door.radiusY
  return normalizedX * normalizedX + normalizedY * normalizedY <= 1
}

function isHeroFacingDoor(hero: UnitEntity, building: BuildingWithInteriorConfig): boolean {
  const door = doorConfigForBuilding(building)
  if (!door || typeof hero.degree !== 'number') return false
  const targetX = building.x + door.facingOffsetX
  const targetY = building.y + door.facingOffsetY
  return angleDelta(getInstanceDegree(hero, targetX, targetY), hero.degree) <= door.facingHalfAngle
}

export function findBuildingInteriorEntryTarget(
  hero: UnitEntity | null,
  buildings: BuildingEntity[] | null | undefined,
  options: { requireFacing?: boolean } = {}
): BuildingEntity | null {
  if (!hero) return null
  const requireFacing = options.requireFacing ?? true
  for (const building of buildings || []) {
    const interiorBuilding = building as BuildingWithInteriorConfig
    if (isHeroInDoorZone(hero, interiorBuilding) && (!requireFacing || isHeroFacingDoor(hero, interiorBuilding))) {
      return building
    }
  }
  return null
}
