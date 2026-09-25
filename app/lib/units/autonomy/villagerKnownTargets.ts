import { withinVillageActivity } from '../villageActivity'
import { nearestResourceRecords } from '../../../classes/resources/CompactResourceSet'
import { knownTarget, knowsEconomicTarget, playerSeesTarget, rememberedStaticTargets } from '../playerTargetKnowledge'
import { sameMapSpace } from '../../mapSpaces'
import { ACTION_TYPES, FAMILY_TYPES, RESOURCE_TYPES, WORK_TYPES } from '../../constants'
import { getGaiaAnimals } from '../../playerState'
import { isWildHorse } from '../../horses/horseTaming'
import { canVillagerAutonomouslyHunt } from '../villagerHunting'
import { targetWorkerLoad } from '../villagerAutonomyTargeting'
import { logGoldMinerFlow } from './villagerJobDiagnostics'
import type { BuildingEntity, ResourceEntity, RuntimeEntity, UnitEntity } from '../../../types/entities'

function isAliveEntity(entity: RuntimeEntity | null | undefined): entity is RuntimeEntity {
  return Boolean(entity && !entity.isDead && !entity.isDestroyed && (entity.hitPoints ?? 1) > 0)
}

function isUsableResource(entity: RuntimeEntity | null | undefined): entity is ResourceEntity {
  // A felled tree has no hit points but remains harvestable until its wood is depleted.
  return Boolean(
    entity &&
      !entity.isDead &&
      !entity.isDestroyed &&
      (entity.type === RESOURCE_TYPES.tree || (entity.hitPoints ?? 1) > 0) &&
      entity.family === FAMILY_TYPES.resource &&
      (entity.quantity ?? 1) > 0
  )
}

function isUsableAnimalCarcass(entity: RuntimeEntity | null | undefined): entity is RuntimeEntity {
  return Boolean(
    entity &&
      entity.family === FAMILY_TYPES.animal &&
      entity.isDead &&
      !entity.isDestroyed &&
      (entity.quantity ?? 0) > 0
  )
}

function isCapturableHorse(entity: RuntimeEntity | null | undefined): entity is RuntimeEntity {
  return Boolean(
    entity &&
      entity.family === FAMILY_TYPES.animal &&
      entity.type === 'Horse' &&
      isWildHorse(entity) &&
      !entity.isDead &&
      !entity.isDestroyed &&
      !(entity as { companionOwner?: UnitEntity | null }).companionOwner &&
      !(entity as { isCatchingPoleCaught?: boolean }).isCatchingPoleCaught
  )
}

function isFoodTargetAvailable(unit: UnitEntity, target: RuntimeEntity): boolean {
  if (target.family === FAMILY_TYPES.resource && target.type === RESOURCE_TYPES.wheat) {
    return (
      Boolean(knownTarget(unit.owner, target)?.mature) &&
      targetWorkerLoad(unit, target, WORK_TYPES.farmer, ACTION_TYPES.farm) < 1
    )
  }
  return true
}

function isKnownToUnit(unit: UnitEntity, entity: RuntimeEntity): boolean {
  return withinVillageActivity(unit, entity) && sameMapSpace(unit, entity) && Boolean(knownTarget(unit.owner, entity))
}

function knownState(unit: UnitEntity, entity: RuntimeEntity): RuntimeEntity {
  return (knownTarget(unit.owner, entity) ?? {}) as RuntimeEntity
}

export function knownResources(unit: UnitEntity, type: string, diagnose = false, limit = Infinity): RuntimeEntity[] {
  const owner = unit.owner
  const resources = new Set([
    ...nearestResourceRecords(
      unit.context?.map?.resources,
      type,
      unit,
      limit,
      resource => isKnownToUnit(unit, resource) && isUsableResource(knownState(unit, resource))
    ),
    ...rememberedStaticTargets(unit.owner),
  ])
  const founded = owner?.foundedResources?.[type]
  const source = [...new Map([...(founded ?? []), ...resources].map(resource => [resource.label, resource])).values()]
  const targets = source.filter(
    resource => resource.type === type && isKnownToUnit(unit, resource) && isUsableResource(knownState(unit, resource))
  )
  if (diagnose && type === RESOURCE_TYPES.stone) {
    const hero = unit.context?.controls?.heroUnit
    const stones = source.filter(resource => resource.type === type)
    logGoldMinerFlow(unit, 'autonomy.stone-knowledge', {
      job: 'stone',
      sameOwnerAsHero: hero ? hero.owner === owner : null,
      totalStones: stones.length,
      knownUsableStones: targets.length,
      nearestStones: stones
        .sort(
          (a, b) => Math.abs(unit.i - a.i) + Math.abs(unit.j - a.j) - Math.abs(unit.i - b.i) - Math.abs(unit.j - b.j)
        )
        .slice(0, 10)
        .map(resource => {
          const sameSpace = sameMapSpace(unit, resource)
          const observation = sameSpace ? knownTarget(owner, resource) : undefined
          return {
            label: resource.label,
            i: resource.i,
            j: resource.j,
            space: resource.spaceId ?? 'outside',
            knownToVillager: Boolean(observation),
            economicallyKnownToHero: hero ? knowsEconomicTarget(hero.owner, resource) : null,
            observedHitPoints: observation?.hitPoints ?? null,
            observedQuantity: observation?.quantity ?? null,
            observedDead: observation?.isDead ?? null,
            observedDestroyed: observation?.isDestroyed ?? null,
            reason: !sameSpace
              ? 'different-space'
              : !observation
                ? 'unknown'
                : !targets.includes(resource)
                  ? 'unusable-resource'
                  : 'candidate',
          }
        }),
    })
  }
  return targets
}

export function knownFoodTargets(unit: UnitEntity, limit = Infinity): RuntimeEntity[] {
  const accepts = (resource: ResourceEntity) =>
    isKnownToUnit(unit, resource) &&
    isUsableResource(knownState(unit, resource)) &&
    isFoodTargetAvailable(unit, resource)
  const resources = new Set([
    ...nearestResourceRecords(unit.context?.map?.resources, RESOURCE_TYPES.berrybush, unit, limit, accepts),
    ...nearestResourceRecords(unit.context?.map?.resources, RESOURCE_TYPES.wheat, unit, limit, accepts),
    ...rememberedStaticTargets(unit.owner),
  ])
  const foundedBerries = unit.owner?.foundedResources?.[RESOURCE_TYPES.berrybush] ?? unit.owner?.foundedBerrybushs
  const berries = [
    ...new Map([...(foundedBerries ?? []), ...resources].map(resource => [resource.label, resource])).values(),
  ].filter(resource => resource.type === RESOURCE_TYPES.berrybush)
  const foundedWheat = unit.owner?.foundedResources?.[RESOURCE_TYPES.wheat] ?? unit.owner?.foundedWheats
  const wheat = [
    ...new Map([...(foundedWheat ?? []), ...resources].map(resource => [resource.label, resource])).values(),
  ].filter(resource => resource.type === RESOURCE_TYPES.wheat)
  const foundedCarcasses = unit.owner?.foundedDeadAnimals
  const carcasses = [
    ...new Set([
      ...(foundedCarcasses ?? []),
      ...getGaiaAnimals(unit.context?.map?.gaia),
      ...rememberedStaticTargets(unit.owner),
    ]),
  ].filter(animal => isKnownToUnit(unit, animal))
  const prey = [
    ...new Set([
      ...(unit.owner?.foundedAnimals ?? []),
      ...getGaiaAnimals(unit.context?.map?.gaia).filter(animal => isKnownToUnit(unit, animal)),
    ]),
  ].filter(
    animal =>
      withinVillageActivity(unit, animal) && sameMapSpace(unit, animal) &&
      (knowsEconomicTarget(unit.owner, animal) || playerSeesTarget(unit.owner, animal)) &&
      canVillagerAutonomouslyHunt(unit, animal)
  )
  return [
    ...berries.filter(target => isKnownToUnit(unit, target) && isUsableResource(knownState(unit, target))),
    ...wheat.filter(target => isKnownToUnit(unit, target) && isUsableResource(knownState(unit, target))),
    ...carcasses.filter(target => isKnownToUnit(unit, target) && isUsableAnimalCarcass(knownState(unit, target))),
    ...prey,
  ].filter(target => withinVillageActivity(unit, target) && isFoodTargetAvailable(unit, target))
}

export function knownConstructionTargets(unit: UnitEntity): BuildingEntity[] {
  return (unit.owner?.buildings ?? []).filter(
    building =>
      withinVillageActivity(unit, building) && building.owner === unit.owner &&
      isAliveEntity(building) &&
      (!building.isBuilt || (building.hitPoints ?? 0) < (building.totalHitPoints ?? 0)) &&
      unit.getActionCondition?.(building, ACTION_TYPES.build)
  )
}

export function knownCapturableHorses(unit: UnitEntity): RuntimeEntity[] {
  const foundedHorses = unit.owner?.foundedAnimals
  const source = [...new Set([...(foundedHorses ?? []), ...getGaiaAnimals(unit.context?.map?.gaia)])]

  return source.filter(
    target =>
      withinVillageActivity(unit, target) && sameMapSpace(unit, target) &&
      (knowsEconomicTarget(unit.owner, target) || playerSeesTarget(unit.owner, target)) &&
      isCapturableHorse(target)
  )
}
