import type { RuntimeMap } from '../../types/map'

type MapBlueprintLike = {
  id: string | number
  spawns?: unknown[] | null
  timings?: Record<string, number>
}

export type BlueprintRuntimeMap = RuntimeMap & {
  pregeneratedBlueprintId?: string | number | null
  generationTimings?: Record<string, number>
  playersPos?: unknown[] | null
  blueprintDestroyMs?: number
  blueprintCellCreationMs?: number
  blueprintFillWaterGapsMs?: number
  blueprintNormalizeWaterMs?: number
  blueprintInitialWaterBorderMs?: number
  blueprintResourceLoadMs?: number
}

export function recordLoadedMapBlueprint(
  map: BlueprintRuntimeMap,
  blueprint: MapBlueprintLike,
  source: 'pregenerated-blueprint' | 'save-pregenerated-blueprint',
  startedAt?: number
): void {
  map.pregeneratedBlueprintId = blueprint.id
  console.info('[maps] Loaded map', {
    source,
    id: blueprint.id,
    size: map.size,
    environment: map.environment,
    seed: map.seed,
    spawns: blueprint.spawns?.length ?? map.playersPos?.length ?? 0,
  })
  if (startedAt == null) return
  map.generationTimings = {
    terrainAndSpawns: performance.now() - startedAt,
    ...(blueprint.timings || {}),
    blueprintDestroy: map.blueprintDestroyMs || 0,
    blueprintCellCreation: map.blueprintCellCreationMs || 0,
    blueprintFillWaterGaps: map.blueprintFillWaterGapsMs || 0,
    blueprintNormalizeWater: map.blueprintNormalizeWaterMs || 0,
    blueprintInitialWaterBorder: map.blueprintInitialWaterBorderMs || 0,
    blueprintResources: map.blueprintResourceLoadMs || 0,
  }
}
