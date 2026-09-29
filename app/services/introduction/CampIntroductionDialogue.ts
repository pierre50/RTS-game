import { t } from '../../lib/lang'
import type { DialogueSequence } from '../../types/dialogue'

/** One reply at a time leads from the rescue to the first concrete task. */
export function createCampIntroductionDialogue(options: {
  nodeId?: string
  onNodeChanged(nodeId: string): void
  onComplete(): void
}): DialogueSequence {
  const steps = [
    ['wake', 'introductionCampDialogue', 'introductionAskRescue'],
    ['rescue', 'introductionAnswerRescue', 'introductionAskAttack'],
    ['attack', 'introductionAnswerAttack', 'introductionAskNext'],
    ['next', 'introductionAnswerNext', 'introductionAskHouse'],
    ['house', 'introductionAnswerHouse', 'introductionAskBuild'],
    ['build', 'introductionAnswerBuild', 'introductionAskLead'],
    ['lead', 'introductionAnswerLead', 'introductionCampReply'],
  ]
  const nodes = steps.map(([id, line, reply], index) => ({
    id,
    line: t(line),
    choices: [{ id: steps[index + 1]?.[0] ?? 'ready', label: t(reply), nextId: steps[index + 1]?.[0] }],
  }))
  return {
    nodes,
    // The old question hub resumes at the practical part of the conversation.
    startId: options.nodeId === 'questions' ? 'next'
      : nodes.some(node => node.id === options.nodeId) ? options.nodeId! : 'wake',
    onNodeChanged: options.onNodeChanged,
    onComplete: options.onComplete,
  }
}
