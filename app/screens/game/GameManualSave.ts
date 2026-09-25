import { cloneSaveSnapshot } from '../../serialization/SaveSnapshot'
import type { SaveProgress } from '../../serialization/AsyncSaveStorage'
import { t } from '../../lib/lang'
import { createInitialCampaignSave, isCampaignSave } from '../../serialization/CampaignSave'
import {
  autosaveRecordAsync,
  buildSaveRecord,
  saveRecordAsync as saveRecordToStorage,
} from '../../serialization/SaveStorage'
import type Game from '../Game'
import { buildBuildingInteriorSessionSaveRecord, type BuildingInteriorTravelGame } from './GameBuildingInteriorTravel'
import { ensureCampaignPlayerRoster } from './GameStateHelpers'

type StoredSave = { key: string; name: string }

export async function saveGameManually(this: Game): Promise<StoredSave> {
  const result = await persistGameSave(this, false)
  if (!result) throw new Error('Manual save was not stored')
  return result
}

export function autosaveGame(this: Game): Promise<StoredSave | null> {
  return persistGameSave(this, true)
}

async function persistGameSave(game: Game, automatic: boolean): Promise<StoredSave | null> {
  if (game.context.defeat || game.context.controls?.heroUnit?.isDead) {
    if (automatic) return null
    throw new Error('Cannot save a defeated hero')
  }
  const record = game._withBuildingInteriorLayerRuntimeRestored(() => {
    const interiorRecord = buildBuildingInteriorSessionSaveRecord(game as BuildingInteriorTravelGame)
    let record = interiorRecord
    if (!record) {
      const current = buildSaveRecord(game._gameContext(), game._campaignSave)
      game._campaignSave = ensureCampaignPlayerRoster(
        isCampaignSave(current) ? cloneSaveSnapshot(current) : createInitialCampaignSave(current)
      )
      record = game._campaignSave
    }
    game._restartSaveData = cloneSaveSnapshot(record)
    return cloneSaveSnapshot(record)
  })
  const result = automatic ? await autosaveRecordAsync(record, t('autosave')) : await saveRecordToStorage(record)
  if (result) game._lastSavedRecord = record
  return result
}

export async function autosaveGameCampaign(
  this: Game,
  onProgress?: (progress: SaveProgress) => void
): Promise<boolean> {
  if (this.context.defeat || this.context.controls?.heroUnit?.isDead) return false
  // Capture while interior layers are restored; never leave the live scene swapped during an await.
  const record = this._withBuildingInteriorLayerRuntimeRestored(() => {
    const source = buildBuildingInteriorSessionSaveRecord(this as BuildingInteriorTravelGame) ?? this._campaignSave
    return source ? cloneSaveSnapshot(source) : null
  })
  if (!record) return false
  this._initialSaveFailureReason = undefined
  const result = await autosaveRecordAsync(record, t('autosave'), onProgress, error => {
    this._initialSaveFailureReason = error instanceof Error ? error.message : String(error)
  })
  if (result) this._lastSavedRecord = record
  return Boolean(result)
}
