import { isChiefUnit } from '../lib/chief'
import { isNpcStillSleeping } from '../lib/npc/npcSleep'
import { t } from '../lib/lang'
import { getCivilizationDefinition } from '../config/civilizations'
import { createQuestMarker } from './QuestMarker'
import { formatQuestText } from '../services/quests/QuestText'
import type { MenuHost } from './MenuHost'
import type { UnitEntity } from '../types/entities'
import type { QuestInteraction } from '../types/quest'

type NpcTopic = 'quest' | 'lore'

/** Quest choices are independent of command permissions and the NPC's inventory menu. */
export class NpcQuestPanel {
  readonly root = document.createElement('div')
  private signature = ''
  /** Offers and lore use topics; active quest actions are available immediately. */
  private topicFor: { npc: UnitEntity; topic: NpcTopic } | null = null
  constructor(
    private readonly menu: MenuHost,
    private readonly showLine: (line: string, npc: UnitEntity) => void
  ) {
    this.root.className = 'npc-quest-options'
  }

  clear(): void {
    this.signature = ''
    this.topicFor = null
    this.root.replaceChildren()
    this.root.hidden = true
  }

  /** True while showing a topic sub-menu (quest/lore), which owns its own "back" exit. */
  hasTopic(): boolean {
    return this.topicFor !== null
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
    if (this.topicFor && this.topicFor.npc !== npc) this.topicFor = null
    if (this.topicFor?.topic === 'quest' && quest.status !== 'active' && quest.status !== 'available') this.topicFor = null
    const topic = this.topicFor?.npc === npc ? this.topicFor.topic : null
    const civ = isChiefUnit(npc) ? getCivilizationDefinition(npc.owner?.civ ?? '').value : null
    const resources = this.menu.context.controls?.heroUnit?.inventory?.resources
    const label = (key: string) => formatQuestText({ key }, quest, resources)
    const definition = runtime.system.definitions.get(quest.definitionId)
    const stage = definition?.stages.find(item => item.id === quest.stageId)
    const interactions = quest.status === 'active' ? (stage?.interactions ?? []).filter(interaction =>
      runtime.system.canInteract(quest, interaction, runtime.environment(npc))
    ) : []
    const ready = interactions.some(interaction => interaction.nextStageId !== undefined)
    const authoredLine = quest.status === 'completed' ? definition?.completedDialogue
      : ready && stage?.readyDialogue ? stage.readyDialogue : stage?.dialogue
    const questLine = authoredLine ? formatQuestText(authoredLine, quest, resources) : label(
      quest.status === 'completed'
        ? 'questResourceThanks'
        : quest.status === 'active'
          ? 'questResourceReminder'
          : 'questResourceOffer'
    )
    const line = topic === 'lore' && civ ? t(`civ${civ}Lore`)
      : topic === 'quest' || quest.status === 'active' ? questLine : t('npcTopicsPrompt')
    const signature = JSON.stringify([quest.id, quest.status, quest.stageId, quest.facts, this.menu.context.controls?.heroUnit?.inventory, topic])
    if (!force && signature === this.signature) return line
    this.signature = signature
    if (!force) this.showLine(line, npc)
    this.root.replaceChildren()
    this.root.hidden = false
    const add = (text: string, run: () => void, disabled = false, marked = false) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'ui-btn'
      if (marked) button.appendChild(createQuestMarker())
      button.appendChild(document.createTextNode(text))
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
    const runInteraction = (interaction: QuestInteraction) => {
      const succeeded = runtime.interact(npc, interaction.id)
      if (succeeded && interaction.nextStageId === null) {
        const thanks = definition?.completedDialogue ?? { key: 'questResourceThanks' }
        this.menu.showMessage(`${npc.name || quest.owner.name} : ${formatQuestText(thanks, quest, resources)}`, 'success')
        this.menu.updateTopbar?.()
        this.menu.closeNpcOrders?.()
        return
      }
      if (succeeded) this.topicFor = { npc, topic: 'quest' }
      changed()
      if (succeeded && interaction.closeDialogue) this.menu.closeNpcOrders?.()
    }
    const addActiveQuest = () => {
      for (const interaction of interactions) {
        add(formatQuestText(interaction.text, quest, resources), () => runInteraction(interaction), false, true)
      }
    }
    if (!topic) {
      if (quest.status === 'active') addActiveQuest()
      else if (quest.status === 'available') {
        add(t('questTopicAsk'), () => {
          this.topicFor = { npc, topic: 'quest' }
          changed()
        }, false, true)
      }
      if (civ) {
        add(t('civLoreButton'), () => {
          this.topicFor = { npc, topic: 'lore' }
          changed()
        })
      }
      return line
    }
    if (topic === 'quest') {
      if (quest.status === 'available') {
        const canDeliverOffer = (interaction: QuestInteraction) =>
          quest.status === 'available' && quest.bindings[interaction.actor] === npc.label &&
          runtime.system.canInteract({ ...quest, status: 'active' }, interaction, runtime.environment(npc))
        const delivery = stage?.interactions.find(interaction =>
          interaction.nextStageId === null && interaction.effects.some(effect => effect.type === 'take-resource') &&
          canDeliverOffer(interaction))
        if (delivery) {
          add(formatQuestText(delivery.text, quest, resources), () => {
            if (!canDeliverOffer(delivery) || !runtime.accept(npc)) {
              changed()
              return
            }
            runInteraction(delivery)
          }, false, true)
        } else add(t('questAccept'), () => {
          if (runtime.accept(npc)) {
            this.menu.showMessage(t('questAccepted'), 'success')
            this.menu.updateTopbar?.()
            this.menu.closeNpcOrders?.()
          } else changed()
        })
      } else if (quest.status === 'active') addActiveQuest()
    }
    add(t(topic === 'lore' ? 'npcTopicAnotherQuestion' : 'questTopicBack'), () => {
      this.topicFor = null
      changed()
    })
    add(t('npcTopicThatsAll'), () => this.menu.closeNpcOrders?.())
    return line
  }
}
