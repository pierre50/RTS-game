import { t } from '../../lib/lang'
import type { QuestInstance, QuestText } from '../../types/quest'
import type { ResourceAmount } from '../../types/common'

export function formatQuestText(text: QuestText, quest: QuestInstance, resources?: ResourceAmount): string {
  const resource = String(quest.parameters.resource ?? '')
  const quantity = Number(quest.parameters.quantity ?? 0)
  const count =
    quest.status === 'completed' ? quantity : Math.min(quantity, resources?.[resource as keyof ResourceAmount] ?? 0)
  const vars = {
    ...quest.parameters,
    resourceLabel: t(resource),
    giver: quest.owner.name,
    count,
    ...text.vars,
  }
  return Object.entries(vars).reduce((line, [key, value]) => line.replaceAll(`{${key}}`, String(value)), t(text.key))
}
