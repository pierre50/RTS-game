import type { QuestDefinition } from '../../types/quest'

export function resourceDeliveryObjective(id: string): QuestDefinition['stages'][number]['objectives'][number] {
  return {
    id,
    text: { key: 'questResourceObjective' },
    conditions: [{ type: 'resource', resource: { parameter: 'resource' }, quantity: { parameter: 'quantity' } }],
  }
}
