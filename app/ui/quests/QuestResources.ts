import { RESOURCE_ICON_IDS } from '../../constants'
import { t } from '../../lib/lang'
import { formatQuestText } from '../../services/quests/QuestText'
import type { ResourceAmount } from '../../types/common'
import type { QuestDefinition, QuestInstance } from '../../types/quest'
import { createResourceIcon } from '../ResourceCost'

/** Decorate quantities in prose without interpreting dialogue as HTML. */
export function renderQuestResourceText(root: HTMLElement, text: string): void {
  const labels = Object.keys(RESOURCE_ICON_IDS)
    .flatMap(key => {
      const label = t(key)
      return [label, `${label}s`, ...(key === 'berry' && label === 'berry' ? ['berries'] : [])].map(label => ({
        key,
        label,
      }))
    })
    .sort((a, b) => b.label.length - a.label.length)
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(
    `\\b(\\d+)\\s+((?:(?:pieces? of|morceaux? de)\\s+)?(${labels.map(({ label }) => escape(label)).join('|')}))(?![\\p{L}\\p{N}_])`,
    'giu'
  )
  root.replaceChildren()
  let offset = 0
  for (const match of text.matchAll(pattern)) {
    const resource = labels.find(({ label }) => label.toLowerCase() === match[3].toLowerCase())
    if (!resource) continue
    root.appendChild(document.createTextNode(text.slice(offset, match.index)))
    const amount = document.createElement('strong')
    amount.className = 'quest-inline-resource'
    amount.appendChild(document.createTextNode(`${match[1]} `))
    const icon = createResourceIcon(resource.key as keyof ResourceAmount)
    icon.title = t(resource.key)
    amount.appendChild(icon)
    amount.appendChild(document.createTextNode(` ${match[2]}`))
    root.appendChild(amount)
    offset = match.index + match[0].length
  }
  root.appendChild(document.createTextNode(text.slice(offset)))
}

export function createQuestObjective(
  objective: QuestDefinition['stages'][number]['objectives'][number],
  quest: QuestInstance,
  resources: ResourceAmount = {}
): HTMLElement {
  const root = document.createElement('span')
  root.className = 'quest-objective'
  // Authored text retains the destination and progress alongside the resource.
  const wood = objective.text.key === 'tutorialWoodObjective'
  const formatted = wood
    ? formatQuestText(
        {
          ...objective.text,
          vars: {
            ...objective.text.vars,
            count: quest.status === 'completed' ? 10 : Math.min(10, resources.wood ?? 0),
          },
        },
        quest,
        resources
      )
    : formatQuestText(objective.text, quest, resources)
  renderQuestResourceText(root, formatted)
  return root
}
