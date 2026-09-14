import type { CampaignSave, SerializedSave } from '../../types/save'

/** Keep old tutorial saves playable with an AI host and a separate guest owner. */
export function migrateTutorialVillageOwner(campaign: CampaignSave, state: SerializedSave): void {
  const tutorial = campaign.tutorial
  if (!tutorial || campaign.introduction || tutorial.worldId !== campaign.currentWorldId) return
  const player = state.players.find(owner => owner.isPlayed)
  if (!player?.units?.some(unit => unit.label === tutorial.chiefLabel)) return
  const hero = player.units.find(unit => unit.type === 'Hero' || unit.controlMode === 'hero')
  if (!hero || !player.label) return
  const oldLabel = player.label
  const guestLabel = `${oldLabel}:guest`
  if (state.players.some(owner => owner.label === guestLabel)) throw new Error('Duplicate tutorial guest owner')
  const village = { ...player, type: 'AI', isPlayed: false, isHuman: false,
    units: player.units.filter(unit => unit !== hero),
    population: player.units.length - 1,
  }
  player.label = guestLabel
  player.units = [hero]
  player.buildings = []
  player.corpses = []
  player.population = 1
  player.populationMax = 1
  player.selectedBuildingLabel = undefined
  player.villagerAssignments = undefined
  state.players.push(village)
  state.config = { ...state.config, heroOnlyStart: true }
  for (const quest of campaign.quests?.quests ?? []) {
    if (quest.assigneeId === oldLabel) quest.assigneeId = guestLabel
  }
}
