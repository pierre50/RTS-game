import type { BuildingEntity } from '../../types/entities'

export function sameBuilding(
  a: Pick<BuildingEntity, 'label'> | null | undefined,
  b: Pick<BuildingEntity, 'label'> | null | undefined
): boolean {
  if (!a || !b) return false
  return a === b || Boolean(a.label && a.label === b.label)
}
