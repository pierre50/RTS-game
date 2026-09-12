import { formatQuestText } from '../services/quests/QuestText'
import { Modal } from '../lib/ui/Modal'
import { t } from '../lib/lang'
import { QuestSystem } from '../services/quests/QuestSystem'
import type { QuestInstance, QuestText } from '../types/quest'
import type { MenuHost } from './MenuHost'
import '../styles/quests.css'

function text(tag: string, content: string, className = ''): HTMLElement {
  const element = document.createElement(tag)
  element.textContent = content
  element.className = className
  return element
}

export class QuestJournalManager {
  readonly system: QuestSystem
  private modal: Modal | null = null
  private content = document.createElement('div')
  private button: HTMLButtonElement | null = null
  private tracker = document.createElement('div')
  private selectedId: string | null = null
  private signature = ''

  constructor(private readonly menu: MenuHost) {
    this.system = new QuestSystem(() => menu.context.getQuestJournal?.() ?? null)
    this.content.className = 'quest-journal'
    this.tracker.className = 'quest-tracker hud-info-panel'
    this.tracker.hidden = true
    menu.gameHud.appendChild(this.tracker)
  }

  createOpenButton(): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'quest-journal-open ui-btn'
    button.setAttribute('aria-haspopup', 'dialog')
    button.addEventListener('click', () => {
      button.blur()
      this.menu.playUiClick()
      this.toggle()
    })
    this.button = button
    this.sync()
    return button
  }

  isOpen(): boolean {
    return this.modal !== null
  }

  toggle(): void {
    if (this.modal) {
      this.close()
      return
    }
    if (this.menu.context.defeat || this.menu.context.devConsoleOpen) return
    this.menu.closeInventory?.()
    this.menu.closeHeroBuildingMenu()
    this.menu.closeEntityInfoModal?.()
    this.menu.closeNpcOrders?.()
    this.modal = new Modal({
      title: t('questJournal'),
      content: this.content,
      onClose: () => {
        this.modal = null
      },
    })
    this.modal._panel?.classList.add('quest-journal-panel')
    this.render()
    this.sync()
  }

  close(): void {
    this.modal?.close()
    this.modal = null
  }

  private label(value: QuestText, quest: QuestInstance): string {
    return formatQuestText(value, quest, this.menu.context.controls?.heroUnit?.inventory?.resources)
  }

  sync(): void {
    const state = this.system.state
    const quests = state?.quests.filter(quest => quest.status !== 'available') ?? []
    const unread = quests.some(quest => quest.unread)
    if (this.button) {
      this.button.textContent = `${t('questJournal')}${unread ? ' !' : ''}`
      this.button.setAttribute('aria-label', t(unread ? 'questJournalUnread' : 'questJournal'))
    }
    const tracked = quests.find(quest => quest.id === state?.trackedQuestId && quest.status === 'active')
    const definition = tracked && this.system.definitions.get(tracked.definitionId)
    const stage = definition?.stages.find(item => item.id === tracked?.stageId)
    this.tracker.hidden = !tracked || !definition
    if (tracked && definition) {
      this.tracker.textContent = `${this.label(definition.title, tracked)} — ${stage?.objectives.map(objective => this.label(objective.text, tracked)).join(' · ') ?? ''}`
    }
    const signature = JSON.stringify([state, this.menu.context.controls?.heroUnit?.inventory?.resources])
    if (this.modal && signature !== this.signature) this.render()
    this.signature = signature
  }

  private render(): void {
    const state = this.system.state
    const quests = state?.quests.filter(quest => quest.status !== 'available') ?? []
    this.content.replaceChildren()
    if (!quests.length) {
      this.content.appendChild(text('p', t('questJournalEmpty'), 'quest-empty'))
      return
    }
    const selected =
      quests.find(quest => quest.id === this.selectedId) ?? quests.find(quest => quest.status === 'active') ?? quests[0]
    this.selectedId = selected.id
    selected.unread = false
    const list = document.createElement('nav')
    list.className = 'quest-list'
    list.setAttribute('aria-label', t('questJournal'))
    for (const status of ['active', 'completed', 'failed', 'cancelled'] as const) {
      const group = quests.filter(quest => quest.status === status)
      if (!group.length) continue
      list.appendChild(text('h3', t(`questStatus_${status}`)))
      for (const quest of group) {
        const definition = this.system.definitions.get(quest.definitionId)
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'quest-list-item ui-btn'
        button.setAttribute('aria-current', String(quest.id === selected.id))
        button.textContent = `${state?.trackedQuestId === quest.id ? '◆ ' : ''}${definition ? this.label(definition.title, quest) : t('questUnavailable')}${quest.unread ? ' !' : ''}`
        button.addEventListener('click', () => {
          this.selectedId = quest.id
          this.render()
          this.sync()
        })
        list.appendChild(button)
      }
    }
    const details = document.createElement('section')
    details.className = 'quest-details'
    const definition = this.system.definitions.get(selected.definitionId)
    details.appendChild(text('h2', definition ? this.label(definition.title, selected) : t('questUnavailable')))
    details.appendChild(text('p', t('questGiver', { name: selected.owner.name }), 'quest-giver'))
    if (definition) {
      details.appendChild(text('p', this.label(definition.description, selected)))
      details.appendChild(text('h3', t('questObjectives')))
      const objectives = document.createElement('ul')
      for (const objective of definition.stages.find(stage => stage.id === selected.stageId)?.objectives ?? []) {
        objectives.appendChild(text('li', this.label(objective.text, selected)))
      }
      details.appendChild(objectives)
    }
    if (selected.status === 'active' && definition) {
      const follow = document.createElement('button')
      follow.type = 'button'
      follow.className = 'ui-btn'
      const tracked = state?.trackedQuestId === selected.id
      follow.textContent = t(tracked ? 'questUntrack' : 'questTrack')
      follow.addEventListener('click', () => {
        this.system.track(tracked ? null : selected.id)
        this.render()
        this.sync()
      })
      details.appendChild(follow)
    }
    this.content.append(list, details)
  }

  destroy(): void {
    this.close()
    this.button?.remove()
    this.tracker.remove()
  }
}
