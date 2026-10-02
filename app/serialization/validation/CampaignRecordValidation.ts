import type { CampaignSave, LoadedGameConfig } from '../../types/save'
import { CAMPAIGN_SAVE_FORMAT } from '../CampaignSave'
import { validateQuestJournal } from '../QuestSave'
import { fail, isObject, validateOptionalFiniteNumber } from './SaveValidationPrimitives'
import { validateWorldEconomy } from './WorldEconomyValidation'
export function validateCampaignRecord(data: CampaignSave, config: LoadedGameConfig): void {
  if (data.version !== 1) fail('Invalid save file: campaign version is unsupported.')
  if (data.format !== CAMPAIGN_SAVE_FORMAT) fail('Invalid save file: campaign format is invalid.')
  if (!isObject(data.worlds)) fail('Invalid save file: campaign worlds are invalid.')
  if (!isObject(data.worldGraph)) fail('Invalid save file: campaign world graph is invalid.')
  if (data.clock != null) {
    if (!isObject(data.clock)) fail('Invalid save file: campaign clock is invalid.')
    validateOptionalFiniteNumber(data.clock.dayNightElapsedMs, 'campaign clock dayNightElapsedMs')
    validateOptionalFiniteNumber(data.clock.savedAt, 'campaign clock savedAt')
  }
  if (!isObject(data.heroParty)) fail('Invalid save file: campaign hero party is invalid.')
  if (!Array.isArray(data.heroParty.followerLabels)) {
    fail('Invalid save file: campaign hero party followers are invalid.')
  }
  const world = data.worlds[data.currentWorldId]
  if (!isObject(world)) fail('Invalid save file: current campaign world is missing.')
  if (world.id !== data.currentWorldId) fail('Invalid save file: current campaign world id is invalid.')
  if (data.tutorial !== undefined) {
    const tutorial = data.tutorial
    if (
      !isObject(tutorial) ||
      (tutorial.dialogueNodeId !== undefined && typeof tutorial.dialogueNodeId !== 'string') ||
      !['sleeping', 'dialogue', 'wood-requested'].includes(String(tutorial.stage)) ||
      !(['worldId', 'houseLabel', 'chiefLabel'] as const).every(
        key => typeof tutorial[key] === 'string' && tutorial[key]
      )
    ) {
      fail('Invalid save file: tutorial is invalid.')
    }
  }
  if (data.introduction !== undefined) {
    const intro = data.introduction
    if (
      !isObject(intro) ||
      !['prepared', 'completed'].includes(String(intro.status)) ||
      !(['worldId', 'companionLabel', 'campfireLabel'] as const).every(
        key => typeof intro[key] === 'string' && intro[key]
      )
    ) {
      fail('Invalid save file: introduction is invalid.')
    }
    if (intro.dialogueNodeId !== undefined && typeof intro.dialogueNodeId !== 'string') {
      fail('Invalid save file: introduction dialogue is invalid.')
    }
    if (intro.phase !== undefined && !['approaching', 'waking', 'dialogue'].includes(String(intro.phase))) {
      fail('Invalid save file: introduction phase is invalid.')
    }
    if (
      intro.arrival !== undefined &&
      (!isObject(intro.arrival) || !Number.isInteger(intro.arrival.i) || !Number.isInteger(intro.arrival.j))
    ) {
      fail('Invalid save file: introduction arrival is invalid.')
    }
  }
  validateQuestJournal(data.quests)
  if (data.economy) validateWorldEconomy(data, config)
}
