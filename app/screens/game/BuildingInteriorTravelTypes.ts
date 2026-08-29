import type { BuildingInteriorTransition } from '../../ui/BuildingInteriorTransition'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity } from '../../types/entities'
import type { RuntimeMap } from '../../types/map'
import type { CampaignSave, SerializedSave } from '../../types/save'
import type { BuildingInteriorOccupantState } from './BuildingInteriorOccupants'

export type BuildingInteriorSession = {
  entryPortalId: string
  returnedOccupants: BuildingInteriorOccupantState[]
  sourceCampaign: CampaignSave
  sourceWorldId: string
  sourceWorldState: SerializedSave
}

export type BuildingInteriorTravelGame = {
  _buildingInteriorSession?: BuildingInteriorSession | null
  _campaignSave: CampaignSave | null
  _isRestarting: boolean
  _loadingScreen?: { destroy?(): void } | BuildingInteriorTransition | null
  _restartSaveData: CampaignSave | null
  context: {
    controls?: GameContextLike['controls'] | null
    menu?: (GameContextLike['menu'] & { show?(): void }) | null
    player?: GameContextLike['player'] | null
    players?: GameContextLike['players']
  }
  _autosaveCampaign(): void
  _bootFromSave(json: SerializedSave): Promise<void>
  _closeBuildingInteriorLayer?(): Promise<void> | void
  _destroyRuntime(options?: { preserveLoadingScreen?: boolean }): void
  _gameContext(): GameContextLike
  _isBuildingInteriorLayerOpen?(): boolean
  _map(): RuntimeMap
  _openBuildingInteriorLayer?(building: BuildingEntity): Promise<void> | void
}
