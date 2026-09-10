import { BUILDING_TYPES, PLAYER_TYPES } from '../../../constants'
import { Player } from '../../players'
import { getPreparedCaves } from './PreparedMapContent'
import type { GameContextLike } from '../../../types/context'
import type { MapGenerationMap } from '../MapGenerationTypes'

/** Instantiate the script's placement verbatim; no random choices at runtime. */
export function placeCave(map: MapGenerationMap, context: GameContextLike): void {
  if (map.mapType === 'interior') return
  for (const placement of getPreparedCaves(map)) {
    if (context.players.some(player => player.buildings.some(building => building.cave?.id === placement.id))) continue
    const { i, j, ...cave } = placement
    let owner = context.players.find(player => player.type === PLAYER_TYPES.gaia && player.diplomacy === 'neutral')
    if (!owner) {
      owner = new Player(
        { type: PLAYER_TYPES.gaia, color: 'blue', diplomacy: 'neutral', isPlayed: false, i, j },
        context
      )
      context.players.push(owner)
    }
    owner.createBuilding({ i, j, cave, type: BUILDING_TYPES.cave, isBuilt: true })
  }
}
