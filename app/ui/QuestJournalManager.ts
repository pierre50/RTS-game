import { formatQuestText } from '../services/quests/QuestText'
import { Modal } from '../lib/ui/Modal'
import { t } from '../lib/lang'
import { AGE_UP_ENABLED } from '../constants'
import { heroCanCommand } from '../lib/chief'
import { AGE_PROGRESSION, isAgeObjectiveComplete } from '../lib/objectives/ageObjectives'
import { QuestSystem } from '../services/quests/QuestSystem'
import { createQuestMarker } from './questMarker'
import type { QuestInstance, QuestText } from '../types/quest'
import type { MenuHost } from './MenuHost'
import '../styles/quests.css'

function text(tag: string, content: string, className = ''): HTMLElement {
  const element = document.createElement(tag)
  element.textContent = content
  element.className = className
  return element
}

type AgeStage = (typeof AGE_PROGRESSION)[number]
type AgeProgressionEntry = { id: string; stage: AgeStage; status: 'active' | 'completed' }
type JournalEntry = { kind: 'quest'; quest: QuestInstance } | ({ kind: 'age' } & AgeProgressionEntry)

function entryId(entry: JournalEntry): string {
  return entry.kind === 'age' ? entry.id : entry.quest.id
}

function entryStatus(entry: JournalEntry): QuestInstance['status'] {
  return entry.kind === 'age' ? entry.status : entry.quest.status
}

export class QuestJournalManager {
  readonly system: QuestSystem
  private modal: Modal | null = null
  private content = document.createElement('div')
  private button: HTMLButtonElement | null = null
  private tracker = document.createElement('div')
  private selectedId: string | null = null
  private signature = ''
  private seenAgeEntryIds = new Set<string>()

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

  private isAgeEntryUnread(id: string): boolean {
    return !this.seenAgeEntryIds.has(id)
  }

  sync(): void {
    const state = this.system.state
    const quests = state?.quests.filter(quest => quest.status !== 'available') ?? []
    const unread =
      quests.some(quest => quest.unread) || this.ageProgressionEntries().some(entry => this.isAgeEntryUnread(entry.id))
    if (this.button) {
      this.button.textContent = t('questJournal')
      if (unread) this.button.appendChild(createQuestMarker())
      this.button.setAttribute('aria-label', t(unread ? 'questJournalUnread' : 'questJournal'))
    }
    const tracked = quests.find(quest => quest.id === state?.trackedQuestId && quest.status === 'active')
    const definition = tracked && this.system.definitions.get(tracked.definitionId)
    const stage = definition?.stages.find(item => item.id === tracked?.stageId)
    this.tracker.hidden = !tracked || !definition
    if (tracked && definition) {
      this.tracker.textContent = `${this.label(definition.title, tracked)} — ${stage?.objectives.map(objective => this.label(objective.text, tracked)).join(' · ') ?? ''}`
    }
    const player = this.menu.context.player
    const signature = JSON.stringify([
      state,
      this.menu.context.controls?.heroUnit?.inventory?.resources,
      player?.age,
      player?.completedObjectives,
    ])
    if (this.modal && signature !== this.signature) this.render()
    this.signature = signature
  }

  private ageProgressionEntries(): AgeProgressionEntry[] {
    if (!AGE_UP_ENABLED) return []
    const player = this.menu.context.player
    if (!player || !heroCanCommand(this.menu.context.controls?.heroUnit)) return []
    return AGE_PROGRESSION.filter(stage => stage.age <= player.age + 1).map(stage => {
      const id = `age-progression-${stage.age}`
      return {
        id,
        stage,
        status: player.age >= stage.age ? ('completed' as const) : ('active' as const),
      }
    })
  }

  private renderAgeProgressionDetails(details: HTMLElement, stage: AgeStage): void {
    const player = this.menu.context.player
    details.appendChild(text('h2', t(stage.labelKey)))
    details.appendChild(text('h3', t('questObjectives')))
    const objectives = document.createElement('ul')
    objectives.className = 'quest-age-objectives'
    for (const objective of stage.objectives) {
      const acquired = isAgeObjectiveComplete(player, objective.id)
      const item = document.createElement('li')
      item.className = `quest-age-objective${acquired ? ' is-acquired' : ''}`
      const marker = document.createElement('span')
      marker.className = `progression-objective-marker ${acquired ? 'is-acquired' : 'is-pending'}`
      marker.setAttribute('aria-hidden', 'true')
      item.append(marker, text('span', t(objective.labelKey)))
      objectives.appendChild(item)
    }
    details.appendChild(objectives)
  }

  private render(): void {
    const state = this.system.state
    const quests = state?.quests.filter(quest => quest.status !== 'available') ?? []
    const entries: JournalEntry[] = [
      ...this.ageProgressionEntries().map(entry => ({ kind: 'age' as const, ...entry })),
      ...quests.map(quest => ({ kind: 'quest' as const, quest })),
    ]
    this.content.replaceChildren()
    if (!entries.length) {
      this.content.appendChild(text('p', t('questJournalEmpty'), 'quest-empty'))
      return
    }
    const selected =
      entries.find(entry => entryId(entry) === this.selectedId) ??
      entries.find(entry => entryStatus(entry) === 'active') ??
      entries[0]
    this.selectedId = entryId(selected)
    if (selected.kind === 'quest') selected.quest.unread = false
    else this.seenAgeEntryIds.add(selected.id)
    const list = document.createElement('nav')
    list.className = 'quest-list'
    list.setAttribute('aria-label', t('questJournal'))
    for (const status of ['active', 'completed', 'failed', 'cancelled'] as const) {
      const group = entries.filter(entry => entryStatus(entry) === status)
      if (!group.length) continue
      list.appendChild(text('h3', t(`questStatus_${status}`)))
      for (const entry of group) {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'quest-list-item ui-btn'
        button.setAttribute('aria-current', String(entryId(entry) === entryId(selected)))
        let unread: boolean
        if (entry.kind === 'age') {
          button.textContent = t(entry.stage.labelKey)
          unread = this.isAgeEntryUnread(entry.id)
        } else {
          const quest = entry.quest
          const definition = this.system.definitions.get(quest.definitionId)
          button.textContent = `${state?.trackedQuestId === quest.id ? '◆ ' : ''}${definition ? this.label(definition.title, quest) : t('questUnavailable')}`
          unread = quest.unread
        }
        if (unread) button.appendChild(createQuestMarker())
        button.addEventListener('click', () => {
          this.selectedId = entryId(entry)
          this.render()
          this.sync()
        })
        list.appendChild(button)
      }
    }
    const details = document.createElement('section')
    details.className = 'quest-details'
    if (selected.kind === 'age') {
      this.renderAgeProgressionDetails(details, selected.stage)
    } else {
      const quest = selected.quest
      const definition = this.system.definitions.get(quest.definitionId)
      details.appendChild(text('h2', definition ? this.label(definition.title, quest) : t('questUnavailable')))
      details.appendChild(text('p', t('questGiver', { name: quest.owner.name }), 'quest-giver'))
      if (definition) {
        details.appendChild(text('p', this.label(definition.description, quest)))
        details.appendChild(text('h3', t('questObjectives')))
        const objectives = document.createElement('ul')
        for (const objective of definition.stages.find(stage => stage.id === quest.stageId)?.objectives ?? []) {
          objectives.appendChild(text('li', this.label(objective.text, quest)))
        }
        details.appendChild(objectives)
      }
      if (quest.status === 'active' && definition) {
        const follow = document.createElement('button')
        follow.type = 'button'
        follow.className = 'ui-btn'
        const tracked = state?.trackedQuestId === quest.id
        follow.textContent = t(tracked ? 'questUntrack' : 'questTrack')
        follow.addEventListener('click', () => {
          this.system.track(tracked ? null : quest.id)
          this.menu.updateCameraMiniMap?.()
          this.render()
          this.sync()
        })
        details.appendChild(follow)
      }
    }
    this.content.append(list, details)
  }

  destroy(): void {
    this.close()
    this.button?.remove()
    this.tracker.remove()
  }
}
