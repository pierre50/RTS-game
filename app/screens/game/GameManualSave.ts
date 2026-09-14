import { t } from '../../lib/lang'
import { createInitialCampaignSave,isCampaignSave } from '../../serialization/CampaignSave'
import { autosaveRecord,buildSaveRecord,saveRecord as saveRecordToStorage } from '../../serialization/SaveStorage'
import type Game from '../Game'
import { buildBuildingInteriorSessionSaveRecord,type BuildingInteriorTravelGame } from './GameBuildingInteriorTravel'
import { ensureCampaignPlayerRoster } from './GameStateHelpers'

type StoredSave = { key: string; name: string }

export function saveGameManually(this: Game): StoredSave {
  const result = persistGameSave(this, false)
  if (!result) throw new Error('Manual save was not stored')
  return result
}

export function autosaveGame(this: Game): StoredSave | null {
  return persistGameSave(this, true)
}

function persistGameSave(game: Game, automatic: boolean): StoredSave | null {
  if (game.context.defeat || game.context.controls?.heroUnit?.isDead) {
    if (automatic) return null
    throw new Error('Cannot save a defeated hero')
  }
  return game._withBuildingInteriorLayerRuntimeRestored(() => {
    const interiorRecord = buildBuildingInteriorSessionSaveRecord(game as BuildingInteriorTravelGame)
    let record = interiorRecord
    if (!record) {
      const current = buildSaveRecord(game._gameContext(), game._campaignSave)
      game._campaignSave = ensureCampaignPlayerRoster(
        isCampaignSave(current) ? structuredClone(current) : createInitialCampaignSave(current)
      )
      record = game._campaignSave
    }
    game._restartSaveData = structuredClone(record)
    const result = automatic ? autosaveRecord(record, t('autosave')) : saveRecordToStorage(record)
    if (result) game._lastSavedRecord = structuredClone(record)
    return result
  })
}

export function autosaveGameCampaign(this: Game): void {
  if (this.context.defeat || this.context.controls?.heroUnit?.isDead) return
  this._withBuildingInteriorLayerRuntimeRestored(() => {
    const record = buildBuildingInteriorSessionSaveRecord(this as BuildingInteriorTravelGame) ?? this._campaignSave
    if (record && autosaveRecord(record, t('autosave'))) this._lastSavedRecord = structuredClone(record)
  })
}
