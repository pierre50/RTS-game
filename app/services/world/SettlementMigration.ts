import type { CampaignSave, SerializedSave } from '../../types/save'

/** Apply the new policy to old campaigns without rebuilding or replenishing any settlement. */
export function freezeLegacySettlements(campaign: CampaignSave, current: SerializedSave): void {
  const states = new Set<SerializedSave>([
    current,
    ...Object.values(campaign.worlds).map(world => world.state),
    ...Object.values(campaign.economy?.regions ?? {}).flatMap(region =>
      region.initialState ? [region.initialState] : []
    ),
  ])
  for (const state of states)
    for (const player of state?.players ?? []) if (player.type === 'AI') player.developmentMode ??= 'static'
}
