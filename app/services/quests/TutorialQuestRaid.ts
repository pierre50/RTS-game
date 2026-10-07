import { t } from '../../lib/lang'
import type { GameContextLike } from '../../types/context'
import type { QuestInstance } from '../../types/quest'
import { tutorialHuntQuest } from './TutorialHuntQuest'

/** Own the in-flight raid request so repeated dialogue closes cannot start it twice. */
export class TutorialQuestRaid {
  private raidPending = false
  constructor(private readonly context: GameContextLike) {}

  dialogueClosed(quest: QuestInstance | undefined, defend: () => boolean): void {
    if (!quest || quest.definitionId !== tutorialHuntQuest.id || quest.status !== 'active') return
    if (quest.stageId === 'alarm' && !defend()) return
    if (quest.stageId !== 'raid' || quest.facts.raidStarted || this.raidPending) return
    const raids = this.context.tributeRaids
    if (!raids?.triggerTutorialRaid) return
    this.raidPending = true
    void raids
      .triggerTutorialRaid()
      .then(started => {
        if (started) {
          quest.facts.raidStarted = true
          this.context.autosave?.()
        } else this.context.menu?.showMessage?.(t('tutorialRaidUnavailable'), 'warning')
      })
      .catch(error => {
        console.error('Unable to start tutorial raid', error)
        this.context.menu?.showMessage?.(t('tutorialRaidUnavailable'), 'warning')
      })
      .finally(() => {
        this.raidPending = false
      })
  }
}
