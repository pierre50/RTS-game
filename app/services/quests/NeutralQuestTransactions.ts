import { VILLAGE_QUEST_CONFIG } from '../../config/gameplay'
import { RESOURCE_STORAGE_NAMES, SOUND_CUES } from '../../constants'
import { playSoundCue } from '../../lib/audio/sound'
import { formatEquipmentStackLabel } from '../../lib/equipment/equipmentSlots'
import { refreshUnitEquipmentStats } from '../../lib/equipment/equipmentStats'
import { t } from '../../lib/lang'
import { refreshBakedLpcUnitAssets } from '../../lib/lpc'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import type { NeutralVillageQuests } from './NeutralVillageQuests'
import { grantQuestRelationReward } from './QuestRelationReward'
import { resourceRequestQuest } from './ResourceRequestQuest'
import { tutorialHuntQuest } from './TutorialHuntQuest'
import { selectTutorialHunt } from './TutorialHuntSelection'
type Host = Pick<NeutralVillageQuests, 'dialogue' | 'system' | 'environment' | 'update'>
export function assignResourceRequest(
  this: Host,
  context: GameContextLike,
  regionId: () => string,
  day: () => number,
  id: string,
  npc: UnitEntity,
  resource: string,
  quantity: number,
  definitionId = resourceRequestQuest.id
): boolean {
  const playerId = context.player?.label
  const owner = npc.owner
  if (
    !playerId ||
    !owner ||
    !regionId() ||
    !STORED_RESOURCES.has(resource) ||
    !Number.isSafeInteger(quantity) ||
    quantity <= 0
  )
    return false
  const existing = this.system.state?.quests.find(quest => quest.id === id)
  if (existing && definitionId === tutorialHuntQuest.id && existing.definitionId === resourceRequestQuest.id) {
    existing.definitionId = definitionId
    existing.stageId = 'wood'
    existing.parameters.rewardGold = 0
    if (existing.status === 'completed') {
      existing.status = 'active'
      existing.facts.legacyWoodDelivered = true
      delete existing.completedDay
      this.system.track(existing.id)
    }
    existing.unread = true
  }
  if (
    existing?.definitionId === tutorialHuntQuest.id &&
    existing.status === 'completed' &&
    existing.stageId === 'hunt'
  ) {
    existing.stageId = 'legacy-hunt'
    existing.status = 'active'
    delete existing.completedDay
    existing.unread = true
    this.system.track(existing.id)
  }
  if (existing) return existing.status === 'active' || existing.status === 'completed'
  if (
    !this.system.offer({
      id,
      definitionId,
      regionId: regionId(),
      repeatable: false,
      owner: { entityLabel: npc.label, playerLabel: owner.label, name: npc.name || owner.name || '' },
      assigneeId: null,
      parameters: {
        resource,
        quantity,
        rewardGold: definitionId === tutorialHuntQuest.id ? 0 : quantity * VILLAGE_QUEST_CONFIG.goldPerResource,
      },
      bindings: { recipient: npc.label },
      status: 'available',
      stageId: this.system.definitions.get(definitionId)?.stages[0]?.id ?? '',
      facts: {},
      usedInteractions: [],
      markers: {},
      unread: false,
    }) ||
    !this.system.accept(id, playerId)
  )
    return false
  this.system.track(id)
  this.update(false)
  return true
}
export function interact(
  this: Host,
  context: GameContextLike,
  regionId: () => string,
  day: () => number,
  npc: UnitEntity,
  interactionId: string
): boolean {
  const quest = this.dialogue(npc)
  const playerId = context.player?.label
  const definition = quest && this.system.definitions.get(quest.definitionId)
  const interaction = definition?.stages
    .find(stage => stage.id === quest?.stageId)
    ?.interactions.find(item => item.id === interactionId)
  if (!quest || !playerId || !interaction || !this.system.canInteract(quest, interaction, this.environment(npc)))
    return false
  const startingHunt = quest.definitionId === tutorialHuntQuest.id && quest.stageId === 'wood'
  const hunt = startingHunt ? selectTutorialHunt(context, npc, quest) : null
  if (startingHunt && !hunt) {
    context.menu?.showMessage?.(t('tutorialNoHuntAvailable'), 'warning')
    return false
  }
  if (!this.system.interact(quest.id, interactionId, playerId, npc.label, this.environment(npc))) return false
  if (quest.definitionId === tutorialHuntQuest.id && quest.stageId === 'alarm') {
    quest.markers = {}
    playSoundCue(SOUND_CUES.ui.underAttack)
  }
  if (hunt) {
    Object.assign(quest.parameters, hunt.parameters)
    quest.markers = hunt.markers
    quest.reservation = hunt.reservation
    this.system.track(quest.id)
  }
  if (interaction.effects.some(effect => effect.type === 'give-item')) {
    const hero = context.controls?.heroUnit
    if (hero) {
      refreshUnitEquipmentStats(hero)
      refreshBakedLpcUnitAssets(hero)
      hero.syncAppearanceLayers?.(hero.currentSheet ?? 'standing')
    }
    for (const effect of interaction.effects) {
      if (effect.type !== 'give-item') continue
      const item =
        typeof effect.resource === 'string' ? effect.resource : String(quest.parameters[effect.resource.parameter])
      const quantity =
        typeof effect.quantity === 'number' ? effect.quantity : Number(quest.parameters[effect.quantity.parameter])
      context.menu?.showMessage?.(
        t(effect.equip ? 'questItemEquipped' : 'questItemReceived', {
          item: formatEquipmentStackLabel(item, quantity),
        }),
        'success'
      )
    }
  }
  if (quest.status === 'completed') quest.completedDay = day()
  if (quest.status === 'completed' && quest.repeatable !== false)
    quest.nextOfferDay = day() + VILLAGE_QUEST_CONFIG.repeatDelayDays
  const message = grantQuestRelationReward(
    context,
    quest,
    npc,
    npc.owner?.isPlayed ? 0 : (definition?.relationReward ?? 0)
  )
  context.menu?.refreshInventory?.()
  this.update()
  if (quest.status === 'completed')
    context.menu?.showMessage?.(
      Number(quest.parameters.rewardGold) > 0
        ? `${message} ${t('questGoldReceived').replace('{quantity}', String(quest.parameters.rewardGold))}`
        : message,
      'success'
    )
  context.autosave?.()
  return true
}
const STORED_RESOURCES = new Set<string>(RESOURCE_STORAGE_NAMES)
