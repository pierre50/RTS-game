import { resourceDeliveryObjective } from './ResourceDeliveryObjective'
import type { QuestDefinition } from '../../types/quest'

export const resourceRequestQuest: QuestDefinition = {
  id: 'neutral-resource-request',
  relationReward: 10,
  title: { key: 'questResourceTitle' },
  description: { key: 'questResourceDescription' },
  stages: [
    {
      id: 'delivery',
      readyDialogue: { key: 'questResourceReady' },
      objectives: [
        resourceDeliveryObjective('deliver'),
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
