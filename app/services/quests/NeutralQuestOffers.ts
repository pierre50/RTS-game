import { resourceReadValues } from '../../classes/resources/CompactResourceSet'
import { VILLAGE_QUEST_CONFIG } from '../../config/gameplay'
import { RESOURCE_TYPES } from '../../constants'
import type { UnitEntity } from '../../types/entities'
import type { RuntimeMap } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import type { QuestInstance } from '../../types/quest'
import { banditCampQuest } from './BanditCampQuest'
import { resourceRequestQuest } from './ResourceRequestQuest'

const GATHERABLE = [
  { resource: 'wood', type: RESOURCE_TYPES.tree },
  { resource: 'stone', type: RESOURCE_TYPES.stone },
  { resource: 'berry', type: RESOURCE_TYPES.berrybush },
] as const
const MAX_REQUEST = 15
const MIN_REQUEST = 5

export type NeutralQuestOfferSource = {
  npc: UnitEntity
  owner: PlayerLike
  regionId: string
  questCount: number
}

function buildOffer(
  source: NeutralQuestOfferSource,
  definitionId: string,
  stageId: string,
  parameters: QuestInstance['parameters']
): QuestInstance {
  const { npc, owner, regionId, questCount } = source
  return {
    id: JSON.stringify([definitionId, regionId, owner.label, npc.label, questCount]),
    definitionId,
    regionId,
    owner: { entityLabel: npc.label, playerLabel: owner.label, name: npc.name || owner.name || '' },
    assigneeId: null,
    parameters,
    bindings: { recipient: npc.label },
    status: 'available',
    stageId,
    facts: {},
    usedInteractions: [],
    markers: {},
    unread: false,
  }
}

export function createBanditCampOffer(source: NeutralQuestOfferSource): QuestInstance {
  return buildOffer(source, banditCampQuest.id, 'clear-camp', { rewardGold: 25 })
}

export function createResourceRequestOffer(
  source: NeutralQuestOfferSource,
  resource: string,
  quantity: number
): QuestInstance {
  return buildOffer(source, resourceRequestQuest.id, 'delivery', {
    resource,
    quantity,
    rewardGold: quantity * VILLAGE_QUEST_CONFIG.goldPerResource,
  })
}

// Requests never exceed 15: stop once each resource has enough, without
// materializing three copies of the continent's resource collection.
function countGatherableResources(map: RuntimeMap): Map<string, number> {
  const available = new Map<string, number>(GATHERABLE.map(choice => [choice.type, 0]))
  for (const resource of resourceReadValues(map.resources)) {
    const current = available.get(resource.type)
    if (current === undefined || resource.isDestroyed || (resource.spaceId ?? 'outside') !== 'outside') continue
    available.set(resource.type, Math.min(MAX_REQUEST, current + Math.max(0, resource.quantity ?? 0)))
    if ([...available.values()].every(amount => amount >= MAX_REQUEST)) break
  }
  return available
}

export function pickResourceRequest(
  map: RuntimeMap,
  previous: QuestInstance | undefined
): { resource: string; quantity: number } | null {
  const available = countGatherableResources(map)
  const choices = GATHERABLE.map(choice => ({ ...choice, available: available.get(choice.type) ?? 0 })).filter(
    choice => choice.available >= MIN_REQUEST
  )
  if (!choices.length) return null
  const requests = choices.flatMap(choice =>
    Array.from({ length: Math.min(MAX_REQUEST, Math.floor(choice.available)) - (MIN_REQUEST - 1) }, (_, index) => ({
      resource: choice.resource,
      quantity: index + MIN_REQUEST,
    }))
  )
  const alternatives = requests.filter(
    request => request.resource !== previous?.parameters.resource || request.quantity !== previous?.parameters.quantity
  )
  const pool = alternatives.length ? alternatives : requests
  return pool[map.randomRange(0, pool.length - 1)]
}
