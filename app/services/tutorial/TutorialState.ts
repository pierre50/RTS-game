import type { CampaignSave } from '../../types/save'

/** The camp conversation completes the tutorial and starts the normal campaign. */
export function isTutorialActive(campaign: CampaignSave | null | undefined): boolean {
  return Boolean(campaign?.tutorial && campaign.introduction?.status !== 'completed')
}
