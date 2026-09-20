import type { QuestDefinition } from '../../types/quest'

export const banditCampQuest: QuestDefinition = {
  id: 'neutral-bandit-camp',
  relationReward: 10,
  title: { key: 'questBanditTitle' },
  description: { key: 'questBanditDescription' },
  completedDialogue: { key: 'questBanditThanks' },
  stages: [{
    id: 'clear-camp',
    dialogue: { key: 'questBanditDialogue' },
      readyDialogue: { key: 'questBanditReady' },
    objectives: [{ id: 'clear', text: { key: 'questBanditObjective' },
      conditions: [{ type: 'fact', key: 'campCleared', value: true }] }],
    interactions: [{
      id: 'report', actor: 'recipient', text: { key: 'questBanditReport' },
      visibleWhen: [], enabledWhen: [], requireObjectives: true,
      effects: [{ type: 'give-resource', resource: 'gold', quantity: { parameter: 'rewardGold' } }],
      nextStageId: null,
    }],
  }],
}
