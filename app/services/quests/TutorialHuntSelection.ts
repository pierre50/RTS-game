import { ANIMAL_CORPSE_DROPS } from '../../config/animalGatherLoot'
import { ensureQuestEncounter } from './QuestEncounterSpawn'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import type { QuestInstance } from '../../types/quest'

/** Prepare one saved group; normal polling never rescans the world's wildlife. */
export function selectTutorialHunt(context: GameContextLike, npc: UnitEntity, quest: QuestInstance):
  Pick<QuestInstance, 'parameters' | 'markers' | 'reservation'> | null {
  const gaia = context.map.gaia
  if (!quest.encounters?.hunt && quest.reservation?.entityLabels.length) {
    const labels = new Set(quest.reservation.entityLabels)
    const targets = (gaia?.animals ?? gaia?.units ?? []).filter(animal => labels.has(animal.label) &&
      !animal.isDestroyed && (animal.quantity ?? 0) > 0)
    const target = targets[0]
    const resource = quest.stageId === 'hunt' ? String(quest.parameters.resource) :
      ANIMAL_CORPSE_DROPS[target?.type]?.[0]?.resource
    if (target && resource) {
      quest.encounters ??= {}
      quest.encounters.hunt = {
        entityLabels: targets.map(animal => animal.label),
        position: quest.markers.hunt?.[0]?.position ?? { i: target.i, j: target.j },
        parameters: { resource, quantity: quest.stageId === 'hunt' ? Number(quest.parameters.quantity) : 3, rewardGold: 0 },
      }
    }
  }
  const requested = quest.stageId === 'hunt' ? String(quest.parameters.resource) : null
  const type = ['Deer', 'BlackGrouse'].find(type => gaia?.config?.animals?.[type] &&
    (!requested || ANIMAL_CORPSE_DROPS[type]?.some(drop => drop.resource === requested)))
  const existing = quest.encounters?.hunt
  if (!existing && (!type || !gaia?.createAnimal)) return null
  const resource = requested ?? (type === 'BlackGrouse' ? 'feather' : 'leather')
  const quantity = quest.stageId === 'hunt' ? Number(quest.parameters.quantity) : 3
  const encounter = existing ?? ensureQuestEncounter(context, quest, 'hunt', npc, {
    count: 3,
    parameters: { resource, quantity, rewardGold: 0 },
    create: cell => gaia!.createAnimal!({ i: cell.i, j: cell.j, type: type! }),
  })
  if (!encounter) return null
  return {
    parameters: encounter.parameters,
    reservation: { entityLabels: encounter.entityLabels, stageIds: ['wood', 'hunt'] },
    markers: { hunt: [{ id: 'hunting-area', spaceId: 'outside', position: encounter.position,
      radius: 8, label: { key: 'tutorialHuntArea' } }] },
  }
}
