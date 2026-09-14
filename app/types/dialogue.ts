export type DialogueChoice = {
  id: string
  label: string
  /** Missing nextId ends the conversation. */
  nextId?: string
}

type DialogueNode = {
  id: string
  line: string
  choices: DialogueChoice[]
}

/** A sequence can branch and rejoin; text is already localized by its author. */
export type DialogueSequence = {
  startId: string
  nodes: DialogueNode[]
  onNodeChanged?(nodeId: string): void
  onComplete(): void
}
