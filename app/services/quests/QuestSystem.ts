import { resourceRequestQuest } from './ResourceRequestQuest'
import type {
  QuestCondition,
  QuestDefinition,
  QuestInstance,
  QuestInteraction,
  QuestJournalState,
  QuestParameter,
} from '../../types/quest'

/** Gameplay adapters must count the relevant inventory and identify targets by saved label. */
type ResourceEffect = {
  type: 'give-resource' | 'take-resource' | 'top-up-resource'
  resource: string
  quantity: number
}

export type QuestEnvironment = {
  regionId: string
  resourceCount(resource: string): number
  targetMatches(label: string, state: 'discovered' | 'spoken-to' | 'defeated' | 'reached'): boolean
  /** Revalidate and commit the entire inventory batch, or return false without changing anything. */
  commitResources(effects: ResourceEffect[]): boolean
}

export function createQuestJournal(): QuestJournalState {
  return { version: 1, quests: [], trackedQuestId: null }
}

// Register authored definitions here when introducing missions. No generated offers at UI construction time.
export const questDefinitions = new Map<string, QuestDefinition>([[resourceRequestQuest.id, resourceRequestQuest]])

export class QuestSystem {
  constructor(
    private readonly readState: () => QuestJournalState | null,
    readonly definitions: ReadonlyMap<string, QuestDefinition> = questDefinitions
  ) {}

  get state(): QuestJournalState | null {
    return this.readState()
  }

  offer(quest: QuestInstance): boolean {
    const state = this.state
    const definition = this.definitions.get(quest.definitionId)
    if (!state || !definition || state.quests.some(item => item.id === quest.id)) return false
    if (quest.status !== 'available' || quest.assigneeId !== null || quest.stageId !== definition.stages[0]?.id)
      return false
    state.quests.push(structuredClone(quest))
    return true
  }

  accept(id: string, playerId: string): boolean {
    const state = this.state
    const quest = state?.quests.find(item => item.id === id)
    if (!state || !quest || !playerId || quest.status !== 'available' || !this.definitions.has(quest.definitionId))
      return false
    quest.status = 'active'
    quest.assigneeId = playerId
    quest.unread = true
    state.trackedQuestId ??= id
    return true
  }

  track(id: string | null): boolean {
    const state = this.state
    if (!state || (id !== null && !state.quests.some(quest => quest.id === id && quest.status === 'active')))
      return false
    state.trackedQuestId = id
    return true
  }

  private resolve(quest: QuestInstance, value: string | number | QuestParameter): string | number | undefined {
    return typeof value === 'object' ? quest.parameters[value.parameter] : value
  }

  matches(quest: QuestInstance, conditions: QuestCondition[], env: QuestEnvironment): boolean {
    return conditions.every(condition => {
      switch (condition.type) {
        case 'resource': {
          const resource = this.resolve(quest, condition.resource)
          const quantity = this.resolve(quest, condition.quantity)
          return (
            typeof resource === 'string' &&
            typeof quantity === 'number' &&
            Number.isFinite(quantity) &&
            quantity >= 0 &&
            (condition.comparison === 'below'
              ? env.resourceCount(resource) < quantity
              : env.resourceCount(resource) >= quantity)
          )
        }
        case 'fact':
          return (quest.facts[condition.key] ?? false) === condition.value
        case 'target': {
          const label = quest.bindings[condition.binding]
          return Boolean(label && env.targetMatches(label, condition.state))
        }
      }
    })
  }

  canInteract(quest: QuestInstance, interaction: QuestInteraction, env: QuestEnvironment): boolean {
    const stage = this.definitions.get(quest.definitionId)?.stages.find(item => item.id === quest.stageId)
    return Boolean(
      stage &&
        quest.status === 'active' &&
        quest.regionId === env.regionId &&
        (interaction.repeatable || !quest.usedInteractions.includes(`${stage.id}/${interaction.id}`)) &&
        this.matches(quest, interaction.visibleWhen, env) &&
        this.matches(quest, interaction.enabledWhen, env) &&
        (!interaction.requireObjectives ||
          stage.objectives.every(objective => this.matches(quest, objective.conditions, env)))
    )
  }

  interact(id: string, interactionId: string, playerId: string, actorLabel: string, env: QuestEnvironment): boolean {
    const state = this.state
    const quest = state?.quests.find(item => item.id === id)
    const definition = quest && this.definitions.get(quest.definitionId)
    const stage = definition?.stages.find(item => item.id === quest?.stageId)
    const interaction = stage?.interactions.find(item => item.id === interactionId)
    if (
      !state ||
      !quest ||
      !stage ||
      !interaction ||
      quest.assigneeId !== playerId ||
      quest.bindings[interaction.actor] !== actorLabel ||
      !this.canInteract(quest, interaction, env)
    )
      return false
    if (
      typeof interaction.nextStageId === 'string' &&
      !definition?.stages.some(item => item.id === interaction.nextStageId)
    )
      return false
    const resources: ResourceEffect[] = []
    for (const effect of interaction.effects) {
      if (effect.type === 'set-fact') continue
      const resource = this.resolve(quest, effect.resource)
      const quantity = this.resolve(quest, effect.quantity)
      if (
        typeof resource !== 'string' ||
        !resource ||
        typeof quantity !== 'number' ||
        !Number.isFinite(quantity) ||
        quantity < 0
      )
        return false
      resources.push({ type: effect.type, resource, quantity })
    }
    if (resources.length && !env.commitResources(resources)) return false
    for (const effect of interaction.effects) {
      if (effect.type === 'set-fact') quest.facts[effect.key] = effect.value
    }
    if (!interaction.repeatable) quest.usedInteractions.push(`${stage.id}/${interaction.id}`)
    if (interaction.nextStageId === null) {
      quest.status = 'completed'
      if (state.trackedQuestId === id) state.trackedQuestId = null
    } else if (interaction.nextStageId !== undefined) quest.stageId = interaction.nextStageId
    quest.unread = true
    return true
  }

  getTrackedMarkers(spaceId: string, regionId: string) {
    const state = this.state
    const quest = state?.quests.find(item => item.id === state.trackedQuestId && item.status === 'active')
    return quest?.regionId === regionId
      ? (quest.markers[quest.stageId] ?? []).filter(marker => marker.spaceId === spaceId)
      : []
  }
}
