import { updateVillageFoundingQuests } from './VillageFoundingQuests'
import { VILLAGE_QUEST_CONFIG } from '../../config/gameplay'
import { clearEntityOverheadIndicator, setEntityOverheadIndicator } from '../../lib/entities/overheadIndicator'
import type { ResourceAmount } from '../../types/common'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import type { RuntimeMap } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import type { QuestInstance } from '../../types/quest'
import { maintainBanditCampEncounter } from './BanditCampEncounter'
import { banditCampQuest } from './BanditCampQuest'
import { assignBanditCamp, hasBanditCampCandidate } from './BanditCampSelection'
import { canTalk, isChiefNearby, isEligibleChief } from './NeutralQuestConversation'
import { getTrackedMarkers } from './NeutralQuestMarkers'
import { createBanditCampOffer, createResourceRequestOffer, pickResourceRequest } from './NeutralQuestOffers'
import { assignResourceRequest, interact } from './NeutralQuestTransactions'
import { commitQuestInventory, questItemCount } from './QuestInventory'
import { QuestSystem, type QuestEnvironment } from './QuestSystem'
import { resourceRequestQuest } from './ResourceRequestQuest'
import { TutorialQuestRaid } from './TutorialQuestRaid'
import { maintainTutorialHunt } from './TutorialHuntUpkeep'
const INDICATOR_LABEL = 'quest-offer-indicator'
type QuestOfferMarker = 'exclamation' | 'question'
export class NeutralVillageQuests {
  private readonly raid: TutorialQuestRaid
  readonly system: QuestSystem
  private taskId: number | null = null
  private initialized = false
  private offerChecks = new WeakMap<UnitEntity, number>()
  private huntChecks = new Map<string, number>()
  private unsubscribeDayChange: (() => void) | null = null
  private marked = new Map<UnitEntity, QuestOfferMarker>()

  constructor(private readonly context: GameContextLike) {
    this.raid = new TutorialQuestRaid(context)
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
    return isEligibleChief(this.context, npc, this.getQuest.bind(this))
  }

  private canTalk(npc: UnitEntity): boolean {
    return canTalk.call(this, this.context, this.eligible.bind(this), npc)
  }

  getQuest(npc: UnitEntity): QuestInstance | undefined {
    const quests =
      this.system.state?.quests.filter(
        quest =>
          this.system.definitions.has(quest.definitionId) &&
          quest.owner.entityLabel === npc.label &&
          quest.owner.playerLabel === npc.owner?.label &&
          quest.regionId === this.regionId()
      ) ?? []
    const quest =
      quests.find(quest => quest.status === 'available' || quest.status === 'active') ?? quests[quests.length - 1]
    if (quest?.definitionId === resourceRequestQuest.id)
      quest.parameters.rewardGold ??= Number(quest.parameters.quantity) * VILLAGE_QUEST_CONFIG.goldPerResource
    return quest
  }

  /** Assign a fixed, one-time resource mission through the normal journal and dialogue. */
  assignResourceRequest(
    id: string,
    npc: UnitEntity,
    resource: string,
    quantity: number,
    definitionId = resourceRequestQuest.id
  ): boolean {
    return assignResourceRequest.call(
      this,
      this.context,
      this.regionId.bind(this),
      this.day.bind(this),
      id,
      npc,
      resource,
      quantity,
      definitionId
    )
  }

  private day(): number {
    return this.context.dayNight?.state.day ?? 1
  }

  private isOfferDue(npc: UnitEntity, previous: QuestInstance, refreshOffers: boolean): boolean {
    if (previous.repeatable === false || previous.status !== 'completed') return false
    if (!refreshOffers && this.offerChecks.get(npc) === this.day()) return false
    this.offerChecks.set(npc, this.day())
    // Legacy completions have no date: start their cooldown on first encounter.
    previous.nextOfferDay ??= (previous.completedDay ?? this.day()) + VILLAGE_QUEST_CONFIG.repeatDelayDays
    if (this.day() < previous.nextOfferDay) return false
    return true
  }

  private shouldOfferBanditCamp(
    npc: UnitEntity,
    owner: PlayerLike,
    map: RuntimeMap,
    previous: QuestInstance | undefined
  ): boolean {
    return Boolean(
      owner.type === 'AI' &&
        !this.context.isTutorialActive?.() &&
        map.grid?.length &&
        Number.isInteger(npc.i) &&
        Number.isInteger(npc.j) &&
        map.randomRange(0, 2) === 0 &&
        previous?.definitionId !== banditCampQuest.id &&
        hasBanditCampCandidate(this.context, npc)
    )
  }

  private ensureOffer(npc: UnitEntity, refreshOffers = true): void {
    if (!this.eligible(npc) || !isChiefNearby(this.context, npc) || !this.system.state || !this.regionId()) return
    const previous = this.getQuest(npc)
    if (previous && !this.isOfferDue(npc, previous, refreshOffers)) return
    const map = this.context.map
    const owner = npc.owner
    if (!map || !owner) return
    const source = { npc, owner, regionId: this.regionId(), questCount: this.system.state.quests.length }
    if (this.shouldOfferBanditCamp(npc, owner, map, previous)) {
      this.system.offer(createBanditCampOffer(source))
      return
    }
    const request = pickResourceRequest(map, previous)
    if (request) this.system.offer(createResourceRequestOffer(source, request.resource, request.quantity))
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
    if (!quest || !playerId || quest.status !== 'available') return false
    if (quest.definitionId === banditCampQuest.id && !assignBanditCamp(this.context, quest, npc)) return false
    if (!this.system.accept(quest.id, playerId)) return false
    if (quest.definitionId === banditCampQuest.id) this.system.track(quest.id)
    this.update()
    this.context.autosave?.()
    return true
  }

  deliver(npc: UnitEntity): boolean {
    return this.interact(npc, 'deliver')
  }

  interact(npc: UnitEntity, interactionId: string): boolean {
    return interact.call(this, this.context, this.regionId.bind(this), this.day.bind(this), npc, interactionId)
  }

  /** Resolve return destinations live so moving NPCs and inventory changes need no saved markers. */
  getTrackedMarkers(spaceId: string, regionId: string) {
    return getTrackedMarkers.call(
      this,
      this.context,
      this.regionId.bind(this),
      this.eligible.bind(this),
      spaceId,
      regionId
    )
  }

  dialogueClosed(npc: UnitEntity): void {
    if (!this.canTalk(npc)) return
    this.raid.dialogueClosed(this.getQuest(npc), () => this.interact(npc, 'defend'))
  }

  private maintainTutorialHunt(quest: QuestInstance, npc: UnitEntity): void {
    maintainTutorialHunt(this.context, quest, npc, this.huntChecks, resource =>
      this.environment(npc).resourceCount(resource)
    )
  }

  private canAdvanceQuest(quest: QuestInstance, npc: UnitEntity): boolean {
    return Boolean(
      quest.status === 'active' &&
        quest.assigneeId === this.context.player?.label &&
        this.system.definitions
          .get(quest.definitionId)
          ?.stages.find(stage => stage.id === quest.stageId)
          ?.interactions.some(
            interaction =>
              interaction.nextStageId !== undefined &&
              this.system.canInteract(quest, interaction, this.environment(npc))
          )
    )
  }

  private refreshNpc(npc: UnitEntity, refreshOffers: boolean): QuestOfferMarker | null {
    if (!this.eligible(npc)) return null
    this.ensureOffer(npc, refreshOffers)
    const quest = this.getQuest(npc)
    if (!quest) return null
    this.maintainTutorialHunt(quest, npc)
    maintainBanditCampEncounter(this.context, quest, npc)
    if (!isChiefNearby(this.context, npc) || !this.canTalk(npc)) return null
    if (quest.status === 'available') return 'exclamation'
    return this.canAdvanceQuest(quest, npc) ? 'question' : null
  }

  private syncMarkers(wanted: Map<UnitEntity, QuestOfferMarker>): void {
    for (const npc of this.marked.keys())
      if (!wanted.has(npc)) clearEntityOverheadIndicator(npc, { fade: false, label: INDICATOR_LABEL })
    for (const [npc, type] of wanted)
      if (this.marked.get(npc) !== type) setEntityOverheadIndicator(npc, type, { label: INDICATOR_LABEL })
    this.marked = wanted
  }

  update(refreshOffers = true): void {
    this.initialized = true
    updateVillageFoundingQuests(this.context, this.system)
    const wanted = new Map<UnitEntity, QuestOfferMarker>()
    for (const player of this.context.players ?? [])
      for (const npc of player.units ?? []) {
        const marker = this.refreshNpc(npc, refreshOffers)
        if (marker) wanted.set(npc, marker)
      }
    this.syncMarkers(wanted)
    this.context.menu?.updateTopbar?.()
    this.context.menu?.updateCameraMiniMap?.()
  }

  destroy(): void {
    this.unsubscribeDayChange?.()
    if (this.taskId !== null) this.context.scheduler?.remove(this.taskId)
    for (const npc of this.marked.keys()) clearEntityOverheadIndicator(npc, { fade: false, label: INDICATOR_LABEL })
    this.marked.clear()
  }
}
