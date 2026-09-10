import { BUILDING_TYPES } from '../../../constants'
import { ensureNeutralPlayer } from '../../players'
import { getPreparedCaves } from './PreparedMapContent'
import type { GameContextLike } from '../../../types/context'
import type { MapGenerationMap } from '../MapGenerationTypes'

/** Instantiate the script's placement verbatim; no random choices at runtime. */
export function placeCave(map: MapGenerationMap, context: GameContextLike): void {
  if (map.mapType === 'interior') return
  for (const placement of getPreparedCaves(map)) {
    if (context.players.some(player => player.buildings.some(building => building.cave?.id === placement.id))) continue
    const { i, j, ...cave } = placement
    const owner = ensureNeutralPlayer(context, { i, j })
    owner.createBuilding({ i, j, cave, type: BUILDING_TYPES.cave, isBuilt: true })
  }
}
