import type { QuestDefinition } from '../../types/quest'

export const resourceRequestQuest: QuestDefinition = {
  id: 'neutral-resource-request',
  relationReward: 10,
  title: { key: 'questResourceTitle' },
  description: { key: 'questResourceDescription' },
  stages: [
    {
      id: 'delivery',
      objectives: [
        {
          id: 'deliver',
          text: { key: 'questResourceObjective' },
          conditions: [{ type: 'resource', resource: { parameter: 'resource' }, quantity: { parameter: 'quantity' } }],
        },
      ],
      interactions: [
        {
          id: 'deliver',
          actor: 'recipient',
          text: { key: 'questResourceGive' },
          visibleWhen: [],
          enabledWhen: [],
          requireObjectives: true,
          effects: [
            { type: 'take-resource', resource: { parameter: 'resource' }, quantity: { parameter: 'quantity' } },
            { type: 'give-resource', resource: 'gold', quantity: { parameter: 'rewardGold' } },
          ],
          nextStageId: null,
        },
      ],
    },
  ],
}
