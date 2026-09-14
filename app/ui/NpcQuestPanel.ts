import { isChiefUnit } from '../lib/chief'
import { isNpcStillSleeping } from '../lib/npc/npcSleep'
import { t } from '../lib/lang'
import { formatQuestText } from '../services/quests/QuestText'
import type { MenuHost } from './MenuHost'
import type { UnitEntity } from '../types/entities'

/** Quest choices are independent of command permissions and the NPC's inventory menu. */
export class NpcQuestPanel {
  readonly root = document.createElement('div')
  private signature = ''
  constructor(
    private readonly menu: MenuHost,
    private readonly showLine: (line: string, npc: UnitEntity) => void
  ) {
    this.root.className = 'npc-quest-options'
  }

  clear(): void {
    this.signature = ''
    this.root.replaceChildren()
    this.root.hidden = true
  }

  update(npc: UnitEntity | null, force = false): string | null {
    const runtime = this.menu.context.neutralQuests
    if (npc && isNpcStillSleeping(npc) && (isChiefUnit(npc) || runtime?.getQuest?.(npc))) {
      const signature = `sleeping:${npc.label}`
      const changed = this.signature !== signature
      this.clear()
      this.signature = signature
      const line = t('npcQuestSleeping')
      if (!force && changed) this.showLine(line, npc)
      return line
    }
    const quest = npc && runtime?.dialogue(npc)
    if (!npc || !quest || !runtime) {
      this.clear()
      return null
    }
    const resources = this.menu.context.controls?.heroUnit?.inventory?.resources
    const label = (key: string) => formatQuestText({ key }, quest, resources)
    const definition = runtime.system.definitions.get(quest.definitionId)
    const stage = definition?.stages.find(item => item.id === quest.stageId)
    const authoredLine = quest.status === 'completed' ? definition?.completedDialogue : stage?.dialogue
    const line = authoredLine ? formatQuestText(authoredLine, quest, resources) : label(
      quest.status === 'completed'
        ? 'questResourceThanks'
        : quest.status === 'active'
          ? 'questResourceReminder'
          : 'questResourceOffer'
    )
    const signature = JSON.stringify([quest.id, quest.status, quest.stageId, quest.facts, this.menu.context.controls?.heroUnit?.inventory])
    if (!force && signature === this.signature) return line
    this.signature = signature
    if (!force) this.showLine(line, npc)
    this.root.replaceChildren()
    this.root.hidden = false
    const add = (text: string, run: () => void, disabled = false) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'ui-btn'
      button.textContent = text
      button.disabled = disabled
      button.addEventListener('click', () => {
        this.menu.playUiClick()
        run()
      })
      this.root.appendChild(button)
    }
    const changed = () => {
      const next = this.update(npc, true)
      if (next) this.showLine(next, npc)
      this.menu.updateTopbar?.()
    }
    if (quest.status === 'available') {
      add(t('questAccept'), () => {
        if (runtime.accept(npc)) this.menu.showMessage(t('questAccepted'), 'success')
        changed()
      })
    } else if (quest.status === 'active') {
      const progress = document.createElement('p')
      progress.textContent = stage?.objectives.map(objective => formatQuestText(objective.text, quest, resources)).join('\n') ?? ''
      this.root.appendChild(progress)
      for (const interaction of stage?.interactions ?? []) {
        if (!runtime.system.matches(quest, interaction.visibleWhen, runtime.environment(npc))) continue
        add(`! ${formatQuestText(interaction.text, quest, resources)}`, () => {
          const succeeded = runtime.interact(npc, interaction.id)
          changed()
          if (succeeded && interaction.closeDialogue) this.menu.closeNpcOrders?.()
        }, !runtime.system.canInteract(quest, interaction, runtime.environment(npc)))
      }
    }
    return line
  }
}
