import { t } from '../../lib/lang'
import type { DialogueChoice, DialogueSequence } from '../../types/dialogue'

/** Optional questions return to a hub; only the farewell begins the campaign. */
export function createCampIntroductionDialogue(options: {
  nodeId?: string
  onNodeChanged(nodeId: string): void
  onComplete(): void
}): DialogueSequence {
  const finish: DialogueChoice = { id: 'ready', label: t('introductionCampReply') }
  const topics: DialogueChoice[] = [
    { id: 'attack', label: t('introductionAskAttack'), nextId: 'attack' },
    { id: 'rescue', label: t('introductionAskRescue'), nextId: 'rescue' },
    { id: 'next', label: t('introductionAskNext'), nextId: 'next' },
    { id: 'lead', label: t('introductionAskLead'), nextId: 'lead' },
    finish,
  ]
  const followups: DialogueChoice[] = [
    { id: 'questions', label: t('introductionMoreQuestions'), nextId: 'questions' },
    finish,
  ]
  const nodes = [
    { id: 'wake', line: t('introductionCampDialogue'), choices: topics },
    { id: 'questions', line: t('introductionQuestionsReply'), choices: topics },
    ...(['attack', 'rescue', 'next', 'lead'] as const).map(id => ({
      id,
      line: t({ attack: 'introductionAnswerAttack', rescue: 'introductionAnswerRescue',
        next: 'introductionAnswerNext', lead: 'introductionAnswerLead' }[id]),
      choices: followups,
    })),
  ]
  return {
    nodes,
    startId: nodes.some(node => node.id === options.nodeId) ? options.nodeId! : 'wake',
    onNodeChanged: options.onNodeChanged,
    onComplete: options.onComplete,
  }
}
