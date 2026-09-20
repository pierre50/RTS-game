import type Game from '../Game'
import { recoverGameAfterDefeat } from './GameBootFlow'
export function handleGameDefeat(game: Game): void {
  const campaign = game._campaignSave
  const raid = Boolean(
    campaign?.tutorial &&
      !campaign.introduction &&
      campaign.quests?.quests.some(
        quest => quest.definitionId === 'tutorial-first-tasks' && quest.status === 'active' && quest.stageId === 'raid'
      )
  )
  void recoverGameAfterDefeat(game, raid).catch(error => {
    console.error('Unable to recover after defeat', error)
    game.quit()
  })
}
