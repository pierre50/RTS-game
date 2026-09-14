import { formatEquipmentStackLabel } from '../../lib/equipment/equipmentSlots'
import { isNpcStillSleeping } from '../../lib/npc/npcSleep'
import { playSoundCue } from '../../lib/audio/sound'
import { SOUND_CUES } from '../../constants'
import { VILLAGE_QUEST_CONFIG } from '../../config/gameplay'
import { t } from '../../lib/lang'
import { grantQuestRelationReward } from './QuestRelationReward'
import { RESOURCE_TYPES, RESOURCE_STORAGE_NAMES } from '../../constants'
import { isLivingChief } from '../../lib/chief'
import { isNeutralPlayer } from '../../lib/playerState'
import { clearEntityOverheadIndicator, setEntityOverheadIndicator } from '../../lib/entities/overheadIndicator'
import { QuestSystem, type QuestEnvironment } from './QuestSystem'
import { resourceRequestQuest } from './ResourceRequestQuest'
import { tutorialHuntQuest } from './TutorialHuntQuest'
import { selectTutorialHunt } from './TutorialHuntSelection'
import { commitQuestInventory, questItemCount } from './QuestInventory'
import { refreshUnitEquipmentStats } from '../../lib/equipment/equipmentStats'
import { refreshBakedLpcUnitAssets } from '../../lib/lpc'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import type { ResourceAmount } from '../../types/common'
import type { QuestInstance } from '../../types/quest'

const INDICATOR_LABEL = 'quest-offer-indicator'
const STORED_RESOURCES = new Set<string>(RESOURCE_STORAGE_NAMES)
const GATHERABLE = [
  { resource: 'wood', type: RESOURCE_TYPES.tree },
  { resource: 'stone', type: RESOURCE_TYPES.stone },
  { resource: 'berry', type: RESOURCE_TYPES.berrybush },
] as const

export class NeutralVillageQuests {
  readonly system: QuestSystem
  private taskId: number | null = null
  private initialized = false
  private huntChecks = new Map<string, number>()
  private unsubscribeDayChange: (() => void) | null = null
  private marked = new Map<UnitEntity, 'exclamation' | 'question'>()

  constructor(private readonly context: GameContextLike) {
    this.system = new QuestSystem(() => context.getQuestJournal?.() ?? null)
    if (!context.editor) {
      this.taskId = context.scheduler?.add(() => this.update(!this.initialized), 500, 'quests.neutralVillages') ?? null
      this.unsubscribeDayChange = context.dayNight?.onDayChange?.(() => this.update()) ?? null
    }
  }

  private regionId(): string {
    return this.context.map?.worldRegionId ?? this.context.getCurrentWorldId?.() ?? ''
  }

  private eligible(npc: UnitEntity): boolean {
    const owner = npc.owner
    if (!owner || !isLivingChief(npc) || this.context.map?.mapType === 'interior') return false
    if (this.getQuest(npc)?.repeatable === false) return this.context.player?.isEnemy?.(owner) !== true
    if (owner.isPlayed) return false
    const faction = owner.factionId ? this.context.getCampaignFactions?.()?.[owner.factionId] : null
    return (
      (faction
        ? ['neutral', 'friendly', 'allied'].includes(faction.relationState)
        : isNeutralPlayer(owner) || owner.diplomacy === 'neutral') && this.context.player?.isEnemy?.(owner) !== true
    )
  }

  private canTalk(npc: UnitEntity): boolean {
    const hero = this.context.controls?.heroUnit
    return Boolean(
      hero &&
        !hero.isDead &&
        !hero.isDestroyed &&
        this.eligible(npc) &&
        !isNpcStillSleeping(npc) &&
        npc.action !== 'attack' &&
        (hero.spaceId ?? 'outside') === (npc.spaceId ?? 'outside')
    )
  }

  getQuest(npc: UnitEntity): QuestInstance | undefined {
    const quests = this.system.state?.quests.filter(
      quest =>
        this.system.definitions.has(quest.definitionId) &&
        quest.owner.entityLabel === npc.label &&
        quest.owner.playerLabel === npc.owner?.label &&
        quest.regionId === this.regionId()
    ) ?? []
    const quest = quests.find(quest => quest.status === 'available' || quest.status === 'active') ?? quests[quests.length - 1]
    if (quest?.definitionId === resourceRequestQuest.id) quest.parameters.rewardGold ??= Number(quest.parameters.quantity) * VILLAGE_QUEST_CONFIG.goldPerResource
    return quest
  }

  /** Assign a fixed, one-time resource mission through the normal journal and dialogue. */
  assignResourceRequest(id: string, npc: UnitEntity, resource: string, quantity: number, definitionId = resourceRequestQuest.id): boolean {
    const playerId = this.context.player?.label
    const owner = npc.owner
    if (!playerId || !owner || !this.regionId() || !STORED_RESOURCES.has(resource) ||
        !Number.isSafeInteger(quantity) || quantity <= 0) return false
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
    if (existing?.definitionId === tutorialHuntQuest.id && existing.status === 'completed' && existing.stageId === 'hunt') {
      existing.stageId = 'legacy-hunt'
      existing.status = 'active'
      delete existing.completedDay
      existing.unread = true
      this.system.track(existing.id)
    }
    if (existing) return existing.status === 'active' || existing.status === 'completed'
    if (!this.system.offer({
      id, definitionId, regionId: this.regionId(), repeatable: false,
      owner: { entityLabel: npc.label, playerLabel: owner.label, name: npc.name || owner.name || '' },
      assigneeId: null, parameters: { resource, quantity, rewardGold: definitionId === tutorialHuntQuest.id ? 0 : quantity * VILLAGE_QUEST_CONFIG.goldPerResource },
      bindings: { recipient: npc.label }, status: 'available', stageId: this.system.definitions.get(definitionId)?.stages[0]?.id ?? '',
      facts: {}, usedInteractions: [], markers: {}, unread: false,
    }) || !this.system.accept(id, playerId)) return false
    this.system.track(id)
    this.update(false)
    return true
  }

  private day(): number {
    return this.context.dayNight?.state.day ?? 1
  }

  private ensureOffer(npc: UnitEntity, refreshOffers = true): void {
    if (!this.eligible(npc) || !this.system.state || !this.regionId()) return
    const previous = this.getQuest(npc)
    if (previous) {
      if (previous.repeatable === false || previous.status !== 'completed' || !refreshOffers) return
      // Legacy completions have no date: start their cooldown on first encounter.
      previous.nextOfferDay ??= (previous.completedDay ?? this.day()) + VILLAGE_QUEST_CONFIG.repeatDelayDays
      if (this.day() < previous.nextOfferDay) return
    }
    const map = this.context.map
    const owner = npc.owner
    if (!map || !owner) return
    const choices = GATHERABLE.map(choice => ({
      ...choice,
      available: [...map.resources].reduce(
        (total, resource) =>
          total +
          (resource.type === choice.type && !resource.isDestroyed && (resource.spaceId ?? 'outside') === 'outside'
            ? Math.max(0, resource.quantity ?? 0)
            : 0),
        0
      ),
    })).filter(choice => choice.available >= 5)
    if (!choices.length) return
    const requests = choices.flatMap(choice =>
      Array.from({ length: Math.min(15, Math.floor(choice.available)) - 4 }, (_, index) => ({
        resource: choice.resource, quantity: index + 5,
      }))
    )
    const alternatives = requests.filter(request =>
      request.resource !== previous?.parameters.resource || request.quantity !== previous?.parameters.quantity
    )
    const pool = alternatives.length ? alternatives : requests
    const choice = pool[map.randomRange(0, pool.length - 1)]
    const quantity = choice.quantity
    const id = JSON.stringify([resourceRequestQuest.id, this.regionId(), owner.label, npc.label, this.system.state.quests.length])
    this.system.offer({
      id,
      definitionId: resourceRequestQuest.id,
      regionId: this.regionId(),
      owner: { entityLabel: npc.label, playerLabel: owner.label, name: npc.name || owner.name || '' },
      assigneeId: null,
      parameters: { resource: choice.resource, quantity, rewardGold: quantity * VILLAGE_QUEST_CONFIG.goldPerResource },
      bindings: { recipient: npc.label },
      status: 'available',
      stageId: 'delivery',
      facts: {},
      usedInteractions: [],
      markers: {},
      unread: false,
    })
  }

  environment(npc?: UnitEntity): QuestEnvironment {
    const hero = this.context.controls?.heroUnit
    return {
      regionId: this.regionId(),
      resourceCount: resource => hero?.inventory?.resources?.[resource as keyof ResourceAmount] ?? 0,
      targetMatches: () => false,
      itemCount: item => questItemCount(hero, item),
      commitResources: effects => Boolean(hero && npc && this.canTalk(npc) && commitQuestInventory(hero, npc, effects)),
    }
  }

  dialogue(npc: UnitEntity): QuestInstance | undefined {
    if (!this.canTalk(npc)) return undefined
    this.ensureOffer(npc)
    const quest = this.getQuest(npc)
    if (quest?.assigneeId && quest.assigneeId !== this.context.player?.label) return undefined
    return quest
  }

  accept(npc: UnitEntity): boolean {
    const quest = this.dialogue(npc)
    const playerId = this.context.player?.label
    if (!quest || !playerId || !this.system.accept(quest.id, playerId)) return false
    this.update()
    return true
  }

  deliver(npc: UnitEntity): boolean {
    return this.interact(npc, 'deliver')
  }

  interact(npc: UnitEntity, interactionId: string): boolean {
    const quest = this.dialogue(npc)
    const playerId = this.context.player?.label
    const definition = quest && this.system.definitions.get(quest.definitionId)
    const interaction = definition?.stages.find(stage => stage.id === quest?.stageId)?.interactions.find(item => item.id === interactionId)
    if (!quest || !playerId || !interaction || !this.system.canInteract(quest, interaction, this.environment(npc))) return false
    const startingHunt = quest.definitionId === tutorialHuntQuest.id && quest.stageId === 'wood'
    const hunt = startingHunt ? selectTutorialHunt(this.context, npc, { ensurePopulation: true }) : null
    if (startingHunt && !hunt) {
      this.context.menu?.showMessage?.(t('tutorialNoHuntAvailable'), 'warning')
      return false
    }
    if (!this.system.interact(quest.id, interactionId, playerId, npc.label, this.environment(npc)))
      return false
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
      const hero = this.context.controls?.heroUnit
      if (hero) {
        refreshUnitEquipmentStats(hero)
        refreshBakedLpcUnitAssets(hero)
        hero.syncAppearanceLayers?.(hero.currentSheet ?? 'standing')
      }
      for (const effect of interaction.effects) {
        if (effect.type !== 'give-item') continue
        const item = typeof effect.resource === 'string' ? effect.resource : String(quest.parameters[effect.resource.parameter])
        const quantity = typeof effect.quantity === 'number' ? effect.quantity : Number(quest.parameters[effect.quantity.parameter])
        this.context.menu?.showMessage?.(t(effect.equip ? 'questItemEquipped' : 'questItemReceived', { item: formatEquipmentStackLabel(item, quantity) }), 'success')
      }
    }
    if (quest.status === 'completed') quest.completedDay = this.day()
    if (quest.status === 'completed' && quest.repeatable !== false) quest.nextOfferDay = this.day() + VILLAGE_QUEST_CONFIG.repeatDelayDays
    const message = grantQuestRelationReward(this.context, quest, npc, npc.owner?.isPlayed ? 0 : definition?.relationReward ?? 0)
    this.context.menu?.refreshInventory?.()
    this.update()
    if (quest.status === 'completed') this.context.menu?.showMessage?.(Number(quest.parameters.rewardGold) > 0
      ? `${message} ${t('questGoldReceived').replace('{quantity}', String(quest.parameters.rewardGold))}` : message, 'success')
    this.context.autosave?.()
    return true
  }

  private raidPending = false

  dialogueClosed(npc: UnitEntity): void {
    if (!this.canTalk(npc)) return
    const quest = this.getQuest(npc)
    if (!quest || quest.definitionId !== tutorialHuntQuest.id || quest.status !== 'active') return
    if (quest.stageId === 'alarm' && !this.interact(npc, 'defend')) return
    if (quest.stageId !== 'raid' || quest.facts.raidStarted || this.raidPending) return
    const raids = this.context.tributeRaids
    if (!raids?.triggerTutorialRaid) return
    this.raidPending = true
    void raids.triggerTutorialRaid().then(started => {
      if (started) {
        quest.facts.raidStarted = true
        this.context.autosave?.()
      } else this.context.menu?.showMessage?.(t('tutorialRaidUnavailable'), 'warning')
    }).catch(error => {
      console.error('Unable to start tutorial raid', error)
      this.context.menu?.showMessage?.(t('tutorialRaidUnavailable'), 'warning')
    }).finally(() => { this.raidPending = false })
  }

  private maintainTutorialHunt(quest: QuestInstance, npc: UnitEntity): void {
    if (quest.definitionId !== tutorialHuntQuest.id || quest.status !== 'active' ||
      !['wood', 'hunt'].includes(quest.stageId) || (npc.spaceId ?? 'outside') !== 'outside') return
    const now = this.context.scheduler?.elapsedMs ?? Date.now()
    if (now < (this.huntChecks.get(quest.id) ?? -Infinity)) return
    this.huntChecks.set(quest.id, now + 5000)
    const resource = quest.stageId === 'hunt' ? String(quest.parameters.resource) : undefined
    const required = quest.stageId === 'hunt' ? Number(quest.parameters.quantity) : 3
    const remaining = resource ? Math.max(0, required - this.environment(npc).resourceCount(resource)) : required
    if (!remaining) return
    const hunt = selectTutorialHunt(this.context, npc, { ensurePopulation: true, resource, quantity: remaining })
    if (!hunt) return
    const changed = JSON.stringify(quest.reservation) !== JSON.stringify(hunt.reservation)
    quest.reservation = hunt.reservation
    if (quest.stageId === 'hunt' && changed) quest.markers = hunt.markers
    if (changed) this.context.autosave?.()
  }

  update(refreshOffers = true): void {
    this.initialized = true
    const wanted = new Map<UnitEntity, 'exclamation' | 'question'>()
    for (const player of this.context.players ?? [])
      for (const npc of player.units ?? []) {
        if (!this.eligible(npc)) continue
        this.ensureOffer(npc, refreshOffers)
        const quest = this.getQuest(npc)
        if (quest) this.maintainTutorialHunt(quest, npc)
        if (!quest || !this.canTalk(npc)) continue
        if (quest.status === 'available') wanted.set(npc, 'exclamation')
        else if (
          quest.status === 'active' &&
          quest.assigneeId === this.context.player?.label &&
          this.system.definitions.get(quest.definitionId)?.stages.find(stage => stage.id === quest.stageId)?.interactions
            .some(interaction => interaction.nextStageId !== undefined && this.system.canInteract(quest, interaction, this.environment(npc)))
        )
          wanted.set(npc, 'question')
      }
    for (const npc of this.marked.keys())
      if (!wanted.has(npc)) clearEntityOverheadIndicator(npc, { fade: false, label: INDICATOR_LABEL })
    for (const [npc, type] of wanted)
      if (this.marked.get(npc) !== type) setEntityOverheadIndicator(npc, type, { label: INDICATOR_LABEL })
    this.marked = wanted
    this.context.menu?.updateTopbar?.()
  }

  destroy(): void {
    this.unsubscribeDayChange?.()
    if (this.taskId !== null) this.context.scheduler?.remove(this.taskId)
    for (const npc of this.marked.keys()) clearEntityOverheadIndicator(npc, { fade: false, label: INDICATOR_LABEL })
    this.marked.clear()
  }
}
