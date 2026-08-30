import { BUILDING_TYPES } from '../../constants'
import type { BuildingEntity, RuntimeEntity } from '../../types/entities'
import type { RuntimeMapSpace } from '../../types/map'

export type StableInteriorSpace = RuntimeMapSpace & {
  building: BuildingEntity
}

const STABLE_INTERIOR_HORSE_LABEL_PATTERN = /:stable-horse:(\d+)$/

export function getStableInteriorHorseIndex(entity: Pick<RuntimeEntity, 'label'> | null | undefined): number | null {
  const match = entity?.label?.match(STABLE_INTERIOR_HORSE_LABEL_PATTERN)
  if (!match) return null
  const index = Number(match[1])
  return Number.isInteger(index) ? index : null
}

export function getStableInteriorHorseLabel(spaceId: string, index: number): string {
  return `${spaceId}:stable-horse:${index}`
}

export function isStableInteriorSpace(space: RuntimeMapSpace | null | undefined): space is StableInteriorSpace {
  return Boolean(space?.kind === 'interior' && (space as StableInteriorSpace).building?.type === BUILDING_TYPES.stable)
}
