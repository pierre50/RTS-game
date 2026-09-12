import { t } from '../lib/lang'
import { formatQuestText } from '../services/quests/QuestText'
import { resourceRequestQuest } from '../services/quests/ResourceRequestQuest'
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
    const quest = npc && runtime?.dialogue(npc)
    if (!npc || !quest || !runtime) {
      this.clear()
      return null
    }
    const resources = this.menu.context.controls?.heroUnit?.inventory?.resources
    const label = (key: string) => formatQuestText({ key }, quest, resources)
    const line = label(
      quest.status === 'completed'
        ? 'questResourceThanks'
        : quest.status === 'active'
          ? 'questResourceReminder'
          : 'questResourceOffer'
    )
    const signature = JSON.stringify([quest.id, quest.status, resources])
    if (!force && signature === this.signature) return line
    this.signature = signature
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
      progress.textContent = label('questResourceProgress')
      this.root.appendChild(progress)
      const interaction = resourceRequestQuest.stages[0].interactions[0]
      add(
        `! ${label('questResourceGive')}`,
        () => {
          runtime.deliver(npc)
          changed()
        },
        !runtime.system.canInteract(quest, interaction, runtime.environment(npc))
      )
    }
    return line
  }
}
