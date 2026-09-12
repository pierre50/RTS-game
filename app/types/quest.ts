/** Serializable mission data. Entity labels are stable save identifiers, never live references. */
export type QuestText = { key: string; vars?: Record<string, string | number> }
export type QuestParameter = { parameter: string }
export type QuestCondition =
  | {
      type: 'resource'
      comparison?: 'at-least' | 'below'
      resource: string | QuestParameter
      quantity: number | QuestParameter
    }
  | { type: 'fact'; key: string; value: boolean }
  | { type: 'target'; binding: string; state: 'discovered' | 'spoken-to' | 'defeated' | 'reached' }
export type QuestEffect =
  | {
      type: 'give-resource' | 'take-resource' | 'top-up-resource'
      resource: string | QuestParameter
      quantity: number | QuestParameter
    }
  | { type: 'set-fact'; key: string; value: boolean }
export type QuestObjective = { id: string; text: QuestText; conditions: QuestCondition[] }
export type QuestMarker = {
  id: string
  spaceId: string
  position: { i: number; j: number }
  radius?: number
  label: QuestText
}
export type QuestInteraction = {
  id: string
  text: QuestText
  actor: string
  visibleWhen: QuestCondition[]
  enabledWhen: QuestCondition[]
  requireObjectives?: boolean
  repeatable?: boolean
  effects: QuestEffect[]
  /** Omitted for help interactions; null completes the quest. */
  nextStageId?: string | null
}
export type QuestStage = {
  id: string
  objectives: QuestObjective[]
  interactions: QuestInteraction[]
}
export type QuestDefinition = {
  relationReward?: number
  id: string
  title: QuestText
  description: QuestText
  stages: QuestStage[]
}
export type QuestInstance = {
  id: string
  definitionId: string
  regionId: string
  owner: { entityLabel: string; playerLabel: string; name: string }
  assigneeId: string | null
  parameters: Record<string, string | number>
  bindings: Record<string, string>
  status: 'available' | 'active' | 'completed' | 'failed' | 'cancelled'
  stageId: string
  facts: Record<string, boolean>
  usedInteractions: string[]
  /** Markers are instantiated once and scoped to their stage and interior space. */
  markers: Record<string, QuestMarker[]>
  unread: boolean
}
export type QuestJournalState = {
  /** Reputation for independent villages without a campaign faction. */
  villageRelations?: Record<string, number>
  version: 1
  quests: QuestInstance[]
  trackedQuestId: string | null
}
