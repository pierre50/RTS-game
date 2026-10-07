import { filterObject, getCellMapPoint, getEntityMapSpace, getGaiaAnimals } from '../../lib'
import { definedProperties } from '../../lib/definedProperties'
import type { DepotReservePolicy } from '../../lib/economy/depotReserves'
import type { VillageHome } from '../../lib/units/village/villageActivity'
import { getWildlifeStore } from '../../services/wildlife/WildlifeStore'
import type { CampBehavior } from '../../types/camp'
import type { CaveDefinition } from '../../types/cave'
import type { ResourceAmount } from '../../types/common'
import type { GameContextLike } from '../../types/context'
import type {
  AnimalEntity,
  RuntimeEntityBase,
  UnitControlMode,
  UnitCreationExtra,
  UnitEntity,
} from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { AssetLevel } from '../../types/pixi'
import type { SaveEntityState, SaveReference } from '../../types/save'
import type { TrainingEntry, TrainingRequest } from '../../types/training'
import { isDerivedInteriorHorse } from '../InteriorBuildingSave'
import { serializeTrainingExtra, serializeTrainingQueue } from '../TrainingSave'

type GridPoint = { i: number; j: number }

type Destination = Partial<GridPoint & { x: number; y: number; label: string }>

type SpriteState = { currentFrame?: number; loop?: boolean }

export type SerializableEntity = RuntimeEntityBase & {
  settlementName?: string
  wildlife?: SaveEntityState['wildlife']
  lastMealAt?: number
  homeHouseLabel?: string
  homeBedLabel?: string
  partnerLabel?: string
  heroHomeResident?: { label: string; name?: string }
  plannedBedLabels?: string[]
  dailySchedule?: UnitEntity['dailySchedule']
  offlineBuilderJob?: SaveEntityState['offlineBuilderJob']
  resourceDeliveryState?: UnitEntity['resourceDeliveryState']
  cave?: CaveDefinition
  placementMirrored?: boolean
  buildingLevel?: number
  interiorUnfurnished?: boolean
  interiorBuildings?: SaveEntityState[]
  interiorPortalId?: string
  trainingTargetType?: string | null
  trainingQueue?: TrainingEntry[]
  trainingRequests?: TrainingRequest[]
  reservePolicy?: DepotReservePolicy
  buildingProduction?: { activeTrainingExtra?: UnitCreationExtra }
  offlineWork?: SaveEntityState['offlineWork']
  shelterState?: { previousWork?: string | null; previousAutonomousJob?: SaveEntityState['autonomousJob'] } | null
  action?: string | null
  assetLevel?: AssetLevel
  assetCiv?: string
  assetType?: string
  blockedGatherApproach?: { target: { label?: string; i: number; j: number }; action: string } | null
  buildQueue?: { label?: string }[] | null
  controlMode?: UnitControlMode
  currentSheet?: string
  degree?: number
  dest?: Destination | null
  direction?: number
  experience?: Record<string, number>
  gender?: SaveEntityState['gender']
  appearanceVariants?: SaveEntityState['appearanceVariants']
  energy?: number
  totalEnergy?: number
  lastEnergySpentAt?: number
  horseColor?: string
  corpseMaterialDecayRemainingMs?: number
  trapPrey?: boolean
  tamingStatus?: SaveEntityState['tamingStatus']
  companionHorseColor?: string | null
  villageHome?: VillageHome
  campBehavior?: CampBehavior
  campPatrolAnchor?: GridPoint | null
  banditCampAnchor?: GridPoint | null
  containedAnimalType?: string | null
  horseAmount?: number
  stableHorses?: Array<{ horseColor?: string }>
  constructionTime?: number
  constructionWorkRequired?: number
  constructionProgress?: number
  constructionMaterials?: SaveEntityState['constructionMaterials']
  buildingUpgrade?: SaveEntityState['buildingUpgrade']
  inventory?: {
    resources?: ResourceAmount
    equipment?: string[]
    equipped?: NonNullable<SaveEntityState['inventory']>['equipped']
    equippedCounts?: NonNullable<SaveEntityState['inventory']>['equippedCounts']
    activeWeapons?: NonNullable<SaveEntityState['inventory']>['activeWeapons']
  }
  marketGold?: number
  marketStock?: string[]
  indestructible?: boolean
  followingHero?: boolean
  pendingRescueThanks?: boolean
  inactif?: boolean
  isBuilt?: boolean
  isUsedBy?: string | { label?: string } | null
  loading?: number | null
  trainingStartedDay?: number | null
  trainingCompleteDay?: number | null
  loop?: boolean
  mountedOnHorse?: boolean
  path?: GridPoint[]
  previousDest?: Destination | null
  previousWork?: string | null
  collectiveTask?: string | null
  collectiveHome?: SaveEntityState['collectiveHome']
  autonomousJob?: SaveEntityState['autonomousJob']
  exploringForAutonomy?: boolean
  berrybushFullTextureName?: string
  queue?: string[]
  realDest?: Destination | null
  isFleeing?: boolean
  isChief?: boolean
  equipmentDurability?: Record<string, number>
  lootEquipment?: string[]
  getVisualSprite?: () => SpriteState | undefined
  currentFrame?: number
  sprite?: SpriteState | null
  textureName?: string
  work?: string | null
}

function pathData(path: GridPoint[] = []) {
  return path.map(({ i, j }) => ({ i, j }))
}

function destinationData(dest?: Destination | null) {
  if (!dest) return dest
  return {
    i: dest.i,
    j: dest.j,
    x: dest.x,
    y: dest.y,
    label: dest.label,
  }
}

function referenceData(dest?: Destination | null): SaveReference | null | undefined {
  if (!dest) return dest
  return [dest.i ?? 0, dest.j ?? 0, dest.label]
}

function getInteriorWorldSaveCell(entity: SerializableEntity): RuntimeCell | null {
  if (!entity.spaceId) return null
  const map = entity.context?.map
  const space = getEntityMapSpace(entity)
  if (!map || space?.kind !== 'interior') return null
  const interiorSpace = space as InteriorSerializableSpace
  if (interiorSpace.exteriorEntryCell) return interiorSpace.exteriorEntryCell
  const building = interiorSpace.building
  return building ? (map.grid[building.i]?.[building.j] ?? null) : null
}

function projectInteriorEntityToWorld(entity: SerializableEntity, data: SaveEntityState): SaveEntityState {
  const cell = getInteriorWorldSaveCell(entity)
  if (!cell) return data
  const space = getEntityMapSpace(entity) as InteriorSerializableSpace | null
  const caveId = (space?.building as { cave?: { id: string } } | undefined)?.cave?.id
  if (caveId) {
    data.cavePosition = { caveId, i: entity.i, j: entity.j }
    data.caveOrders = {
      action: data.action,
      dest: data.dest,
      previousDest: data.previousDest,
      path: data.path,
      realDest: data.realDest,
    }
  }
  const point = getCellMapPoint(cell, entity.context?.map)
  data.i = cell.i
  data.j = cell.j
  data.x = point.x
  data.y = point.y
  data.z = cell.z
  data.action = null
  data.dest = null
  data.path = []
  data.realDest = null
  delete data.currentFrame
  delete data.currentSheet
  delete data.loop
  return data
}

function animalData(animal: SerializableEntity): SaveEntityState {
  if (animal.isDestroyed) {
    return {
      ...filterObject(animal, ['label', 'type', 'i', 'j', 'horseColor', 'totalHitPoints', 'totalQuantity']),
      isDead: true,
      isDestroyed: true,
      hitPoints: 0,
      quantity: 0,
    } as SaveEntityState
  }
  const data = filterObject(animal, [
    'label',
    'name',
    'type',
    'i',
    'j',
    'x',
    'y',
    'z',
    'hitPoints',
    'totalHitPoints',
    'energy',
    'totalEnergy',
    'lastEnergySpentAt',
    'horseColor',
    'trapPrey',
    'tamingStatus',
    'path',
    'work',
    'realDest',
    'zIndex',
    'degree',
    'action',
    'direction',
    'currentSheet',
    'size',
    'inactif',
    'isDead',
    'isDestroyed',
    'quantity',
    'totalQuantity',
    'isFleeing',
    'wildlife',
    'corpseMaterialDecayRemainingMs',
    'inventory',
  ]) as Partial<SaveEntityState>
  return {
    ...data,
    currentFrame:
      (animal.getVisualSprite ? animal.getVisualSprite() : animal.sprite)?.currentFrame ?? animal.currentFrame,
    loop: (animal.getVisualSprite ? animal.getVisualSprite() : animal.sprite)?.loop ?? animal.loop,
    dest: referenceData(animal.dest),
    previousDest: referenceData(animal.previousDest),
    path: pathData(animal.path),
    realDest: destinationData(animal.realDest),
  } as SaveEntityState
}

export function serializeWildAnimal(animal: AnimalEntity): SaveEntityState {
  return structuredClone(animalData(animal as SerializableEntity))
}

export function savedAnimals(context: GameContextLike): SaveEntityState[] {
  const records = new Map<string, SaveEntityState>()
  for (const [label, entry] of getWildlifeStore(context.map)?.entries ?? [])
    records.set(label, structuredClone(entry.state))
  for (const animal of getGaiaAnimals(context.map.gaia)) {
    if (isDerivedInteriorHorse(animal, context.players)) continue
    const state = animalData(animal as SerializableEntity)
    const existing = records.get(state.label!)
    if (existing?.wildlife)
      state.wildlife = {
        ...existing.wildlife,
        lastCorpseMs: context.dayNight?.getElapsedMs?.() ?? context.scheduler?.elapsedMs ?? 0,
      }
    if (!animal.isDestroyed || existing || (animal.isDead && !('trapPrey' in animal && animal.trapPrey)))
      records.set(state.label ?? `unlabelled:${records.size}`, state)
  }
  return [...records.values()]
}

export function unitData(unit: SerializableEntity): SaveEntityState {
  return projectInteriorEntityToWorld(unit, {
    factionExpedition: structuredClone(
      (unit as SerializableEntity & { factionExpedition?: SaveEntityState['factionExpedition'] }).factionExpedition
    ),
    resourceDelivery: unit.resourceDeliveryState
      ? {
          building: referenceData(unit.resourceDeliveryState.building),
          ...(unit.resourceDeliveryState.pickup ? { pickup: { ...unit.resourceDeliveryState.pickup } } : {}),
          returnTask: unit.resourceDeliveryState.returnTask
            ? {
                action: unit.resourceDeliveryState.returnTask.action,
                autonomousJob: unit.resourceDeliveryState.returnTask.autonomousJob,
                work: unit.resourceDeliveryState.returnTask.work,
                dest: referenceData(unit.resourceDeliveryState.returnTask.dest),
              }
            : null,
        }
      : undefined,
    ...filterObject(unit, [
      'label',
      'name',
      'type',
      'i',
      'j',
      'x',
      'y',
      'z',
      'hitPoints',
      'totalHitPoints',
      'energy',
      'totalEnergy',
      'lastEnergySpentAt',
      'dailySchedule',
      'homeHouseLabel',
      'homeBedLabel',
      'partnerLabel',
      'lastMealAt',
      'path',
      'work',
      'previousWork',
      'autonomousJob',
      'collectiveTask',
      'collectiveHome',
      'offlineBuilderJob',
      'exploringForAutonomy',
      'realDest',
      'degree',
      'action',
      'direction',
      'currentSheet',
      'controlMode',
      'size',
      'inactif',
      'isDead',
      'isDestroyed',
      'isChief',
      'inventory',
      'lootEquipment',
      'equipmentDurability',
      'followingHero',
      'pendingRescueThanks',
      'assetCiv',
      'assetLevel',
      'assetType',
      'mountedOnHorse',
      'horseColor',
      'companionHorseColor',
      'villageHome',
      'campBehavior',
      'campPatrolAnchor',
      'banditCampAnchor',
      'experience',
      'offlineWork',
      'trainingTargetType',
      'gender',
      'appearanceVariants',
    ]),
    work: unit.shelterState?.previousWork ?? unit.work,
    autonomousJob: unit.shelterState?.previousAutonomousJob ?? unit.autonomousJob,
    currentFrame: unit.sprite?.currentFrame,
    loop: unit.sprite?.loop,
    dest: referenceData(unit.dest),
    previousDest: referenceData(unit.previousDest),
    path: pathData(unit.path),
    realDest: destinationData(unit.realDest),
    buildQueue: unit.buildQueue?.length
      ? unit.buildQueue.map(target => target.label).filter((label): label is string => typeof label === 'string')
      : undefined,
    blockedGatherApproach: unit.blockedGatherApproach && {
      target: [
        unit.blockedGatherApproach.target.i,
        unit.blockedGatherApproach.target.j,
        unit.blockedGatherApproach.target.label,
      ],
      action: unit.blockedGatherApproach.action,
    },
  })
}

export function buildingData(building: SerializableEntity): SaveEntityState {
  return definedProperties({
    settlementName: building.settlementName,
    ...filterObject(building, [
      'label',
      'i',
      'j',
      'type',
      'spaceId',
      'interiorBuildings',
      'interiorUnfurnished',
      'plannedBedLabels',
      'heroHomeResident',
      'interiorPortalId',
      'cave',
      'queue',
      'loading',
      'trainingStartedDay',
      'trainingCompleteDay',
      'isDead',
      'isDestroyed',
      'isBuilt',
      'hitPoints',
      'quantity',
      'assetCiv',
      'assetLevel',
      'buildingLevel',
      'placementMirrored',
      'totalHitPoints',
      'assetType',
      'horseAmount',
      'stableHorses',
      'containedAnimalType',
      'constructionWorkRequired',
      'constructionTime',
      'constructionProgress',
      'constructionMaterials',
      'buildingUpgrade',
      'inventory',
      'marketGold',
      'marketStock',
      'indestructible',
    ] as const),
    inventory: building.inventory ? definedProperties(building.inventory) : undefined,
    trainingQueue: serializeTrainingQueue(building.trainingQueue),
    reservePolicy: building.reservePolicy ? structuredClone(building.reservePolicy) : undefined,
    trainingRequests: building.trainingRequests?.length ? structuredClone(building.trainingRequests) : undefined,
    trainingExtra: serializeTrainingExtra(building.buildingProduction?.activeTrainingExtra),
    isUsedBy: typeof building.isUsedBy === 'string' ? building.isUsedBy : building.isUsedBy?.label,
  })
}

type InteriorSerializableSpace = {
  building?: SerializableEntity | null
  exteriorEntryCell?: RuntimeCell | null
}
