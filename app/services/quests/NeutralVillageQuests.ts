import { grantQuestRelationReward } from './QuestRelationReward'
import { RESOURCE_TYPES, RESOURCE_STORAGE_NAMES } from '../../constants'
import { isLivingChief } from '../../lib/chief'
import { isNeutralPlayer } from '../../lib/playerState'
import { clearEntityOverheadIndicator, setEntityOverheadIndicator } from '../../lib/entities/overheadIndicator'
import { QuestSystem, type QuestEnvironment } from './QuestSystem'
import { resourceRequestQuest } from './ResourceRequestQuest'
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
  private marked = new Map<UnitEntity, 'exclamation' | 'question'>()

  constructor(private readonly context: GameContextLike) {
    this.system = new QuestSystem(() => context.getQuestJournal?.() ?? null)
    if (!context.editor)
      this.taskId = context.scheduler?.add(() => this.update(), 500, 'quests.neutralVillages') ?? null
  }

  private regionId(): string {
    return this.context.map?.worldRegionId ?? this.context.getCurrentWorldId?.() ?? ''
  }

  private eligible(npc: UnitEntity): boolean {
    const owner = npc.owner
    if (!owner || owner.isPlayed || !isLivingChief(npc) || this.context.map?.mapType === 'interior') return false
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
        npc.sleepVisualState !== 'sleeping' &&
        npc.action !== 'attack' &&
        (hero.spaceId ?? 'outside') === (npc.spaceId ?? 'outside')
    )
  }

  getQuest(npc: UnitEntity): QuestInstance | undefined {
    return this.system.state?.quests.find(
      quest =>
        quest.definitionId === resourceRequestQuest.id &&
        quest.owner.entityLabel === npc.label &&
        quest.owner.playerLabel === npc.owner?.label &&
        quest.regionId === this.regionId()
    )
  }

  private ensureOffer(npc: UnitEntity): void {
    if (!this.eligible(npc) || this.getQuest(npc) || !this.system.state || !this.regionId()) return
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
    const choice = choices[map.randomRange(0, choices.length - 1)]
    const quantity = map.randomRange(5, Math.min(15, Math.floor(choice.available)))
    const id = JSON.stringify([resourceRequestQuest.id, this.regionId(), owner.label, npc.label])
    this.system.offer({
      id,
      definitionId: resourceRequestQuest.id,
      regionId: this.regionId(),
      owner: { entityLabel: npc.label, playerLabel: owner.label, name: npc.name || owner.name || '' },
      assigneeId: null,
      parameters: { resource: choice.resource, quantity },
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
      commitResources: effects => {
        if (!hero || !npc || !this.canTalk(npc)) return false
        const from = { ...hero.inventory?.resources }
        const to = { ...npc.inventory?.resources }
        for (const effect of effects) {
          if (
            effect.type !== 'take-resource' ||
            !STORED_RESOURCES.has(effect.resource) ||
            !Number.isSafeInteger(effect.quantity) ||
            effect.quantity <= 0
          )
            return false
          const resource = effect.resource as keyof ResourceAmount
          if ((from[resource] ?? 0) < effect.quantity) return false
          from[resource] = (from[resource] ?? 0) - effect.quantity
          to[resource] = (to[resource] ?? 0) + effect.quantity
        }
        hero.inventory ??= {}
        npc.inventory ??= {}
        hero.inventory.resources = from
        npc.inventory.resources = to
        return true
      },
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
    const quest = this.dialogue(npc)
    const playerId = this.context.player?.label
    if (!quest || !playerId || !this.system.interact(quest.id, 'deliver', playerId, npc.label, this.environment(npc)))
      return false
    const message = grantQuestRelationReward(this.context, quest, npc, resourceRequestQuest.relationReward ?? 0)
    this.context.menu?.refreshInventory?.()
    this.update()
    this.context.menu?.showMessage?.(message, 'success')
    return true
  }

  update(): void {
    const wanted = new Map<UnitEntity, 'exclamation' | 'question'>()
    for (const player of this.context.players ?? [])
      for (const npc of player.units ?? []) {
        if (!this.eligible(npc)) continue
        this.ensureOffer(npc)
        const quest = this.getQuest(npc)
        if (!quest || !this.canTalk(npc)) continue
        if (quest.status === 'available') wanted.set(npc, 'exclamation')
        else if (
          quest.status === 'active' &&
          quest.assigneeId === this.context.player?.label &&
          this.system.canInteract(quest, resourceRequestQuest.stages[0].interactions[0], this.environment(npc))
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
    if (this.taskId !== null) this.context.scheduler?.remove(this.taskId)
    for (const npc of this.marked.keys()) clearEntityOverheadIndicator(npc, { fade: false, label: INDICATOR_LABEL })
    this.marked.clear()
  }
}
