import { Assets } from 'pixi.js'
import { decodeInteriorPayload } from '../../serialization/InteriorBlueprintLoader'
import type { BuildingEntity } from '../../types/entities'
import type { MapBlueprint } from '../../classes/map/MapGenerationTypes'

type CavePayload = Parameters<typeof decodeInteriorPayload>[0] & { id: string; size: number }

export function getCaveInteriorBlueprint(building: BuildingEntity): MapBlueprint {
  // Caves from saves made before cave blueprints existed use the small room.
  const id = building.cave?.blueprintId ?? 'cave-small-circle'
  const catalog = Assets.cache.get('caveBlueprints') as { blueprints?: CavePayload[] } | undefined
  const payload = catalog?.blueprints?.find(blueprint => blueprint.id === id)
  if (!payload) throw new Error(`Missing cave blueprint: ${id}. Run caves:generate before starting the game.`)
  return {
    ...decodeInteriorPayload(payload, { blueprint: { id, size: payload.size, path: id } }, 'Cave'),
    seed: building.cave?.seed ?? payload.seed ?? 0,
  }
}
