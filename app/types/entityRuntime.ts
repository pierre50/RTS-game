import type { AnimalEntity } from './animalEntity'
import type { BuildingEntity } from './buildingEntity'
import type { ResourceEntity } from './resourceEntity'
import type { UnitEntity } from './unitEntity'

export type RuntimeEntity = UnitEntity | BuildingEntity | ResourceEntity | AnimalEntity
