import { adjustFactionRelation } from "../../lib/combat/factions"
import type Game from '../Game'

export function changeGameFactionRelation(this: Game, factionId: string, delta: number): void {
    const campaign = this._campaignSave
    const faction = campaign?.factions?.[factionId]
    if (!campaign || !faction) return
    this._campaignSave = {
      ...campaign,
      factions: {
        ...(campaign.factions ?? {}),
        [factionId]: adjustFactionRelation(faction, delta, Date.now()),
      },
    }
    this._restartSaveData = structuredClone(this._campaignSave)
  }
