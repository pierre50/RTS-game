import { releaseIfStillLooking } from '../../lib/npc/npcInteraction'
import { isAiChiefResting } from '../../lib/units/chiefAvailability'
import type { GameContextLike, NpcOrdersOpenOptions } from '../../types/context'
import type { DialogueSequence } from '../../types/dialogue'
import type { UnitEntity } from '../../types/entities'

export function availableOrderNpcs(context: GameContextLike, npcs: UnitEntity[]): UnitEntity[] {
  npcs = npcs.filter(npc => !isAiChiefResting(npc, context))
  if (npcs.some(npc => npc.ambientRoadGroup) && npcs.some(npc => !npc.ambientRoadGroup && npc.owner?.isPlayed)) {
    releaseIfStillLooking(npcs.filter(npc => Boolean(npc.ambientRoadGroup)))
    npcs = npcs.filter(npc => !npc.ambientRoadGroup)
  }
  return npcs
}

export function resolveOrderDialogue(options: NpcOrdersOpenOptions): DialogueSequence | undefined {
  const dialogue =
    options.dialogue ??
    (options.scriptedReply
      ? {
          startId: 'reply',
          nodes: [
            {
              id: 'reply',
              line: options.chatterLine ?? '',
              choices: [{ id: 'reply', label: options.scriptedReply.label }],
            },
          ],
          onComplete: options.scriptedReply.onSelect,
        }
      : undefined)
  if (dialogue) {
    const ids = new Set(dialogue.nodes.map(node => node.id))
    if (
      ids.size !== dialogue.nodes.length ||
      !ids.has(dialogue.startId) ||
      dialogue.nodes.some(
        node =>
          !node.choices.length ||
          new Set(node.choices.map(choice => choice.id)).size !== node.choices.length ||
          node.choices.some(choice => choice.nextId !== undefined && !ids.has(choice.nextId))
      )
    )
      throw new Error('Invalid dialogue sequence')
  }
  return dialogue
}

export function isSleepingNpc(npc: UnitEntity | null | undefined): boolean {
  return npc?.shelterState?.reason === 'sleep' && npc.sleepVisualState === 'sleeping'
}

export function canShowNpcOrder(scriptedReplyActive: boolean, id: string, npcs: UnitEntity[]): boolean {
  if (scriptedReplyActive) return false
  if (id === 'follow') return npcs.some(npc => npc.followingHero !== true)
  if (id === 'stay') return npcs.some(npc => npc.followingHero === true)
  return true
}
