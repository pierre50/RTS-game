import { resourceDeliveryObjective } from './ResourceDeliveryObjective'
import type { QuestDefinition, QuestInteraction } from '../../types/quest'

const huntingKit: QuestInteraction['effects'] = [
  { type: 'give-item', resource: 'bow', quantity: 1, equip: true },
  { type: 'give-item', resource: 'arrow_ceramic', quantity: 20, equip: true },
]

const defenseKit: QuestInteraction['effects'] = [
  { type: 'give-item', resource: 'sword_ceramic', quantity: 1, equip: true },
]

export const tutorialHuntQuest: QuestDefinition = {
  id: 'tutorial-first-tasks',
  completedDialogue: { key: 'tutorialHuntThanks' },
  title: { key: 'tutorialTasksTitle' },
  description: { key: 'tutorialTasksDescription' },
  stages: [
    {
      id: 'wood',
      dialogue: { key: 'tutorialWoodReminder' },
      objectives: [
        {
          id: 'wood',
          text: { key: 'tutorialWoodObjective' },
          conditions: [{ type: 'resource', resource: 'wood', quantity: 10 }],
        },
      ],
      interactions: [
        {
          id: 'deliver',
          actor: 'recipient',
          text: { key: 'tutorialGiveWood' },
          visibleWhen: [{ type: 'fact', key: 'legacyWoodDelivered', value: false }],
          enabledWhen: [{ type: 'resource', resource: 'wood', quantity: 10 }],
          effects: [{ type: 'take-resource', resource: 'wood', quantity: 10 }, ...huntingKit],
          nextStageId: 'hunt',
        },
        {
          id: 'continue',
          actor: 'recipient',
          text: { key: 'tutorialContinue' },
          visibleWhen: [{ type: 'fact', key: 'legacyWoodDelivered', value: true }],
          enabledWhen: [],
          effects: huntingKit,
          nextStageId: 'hunt',
        },
      ],
    },
    {
      id: 'hunt',
      dialogue: { key: 'tutorialHuntDialogue' },
      objectives: [
        resourceDeliveryObjective('hunt'),
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
            ...defenseKit,
          ],
          nextStageId: 'alarm',
        },
        {
          id: 'arrows',
          actor: 'recipient',
          text: { key: 'tutorialNeedArrows' },
          visibleWhen: [{ type: 'item', resource: 'arrow', quantity: 1, comparison: 'below' }],
          enabledWhen: [],
          repeatable: true,
          effects: [{ type: 'give-item', resource: 'arrow_ceramic', quantity: 20, equip: true }],
        },
      ],
    },
    {
      id: 'legacy-hunt',
      dialogue: { key: 'tutorialHuntThanks' },
      objectives: [],
      interactions: [{
        id: 'continue', actor: 'recipient', text: { key: 'tutorialContinue' },
        visibleWhen: [], enabledWhen: [], effects: defenseKit, nextStageId: 'alarm',
      }],
    },
    {
      id: 'alarm',
      dialogue: { key: 'tutorialRaidAlarm' },
      objectives: [],
      interactions: [{
        id: 'defend', actor: 'recipient', text: { key: 'tutorialRaidReply' },
        visibleWhen: [], enabledWhen: [], effects: [], nextStageId: 'raid', closeDialogue: true,
      }],
    },
    {
      id: 'raid',
      dialogue: { key: 'tutorialRaidUrgent' },
      objectives: [{ id: 'survive', text: { key: 'tutorialRaidObjective' },
        conditions: [{ type: 'fact', key: 'raidSurvived', value: true }] }],
      interactions: [],
    },
  ],
}
