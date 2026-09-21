import { BUILDING_TYPES } from '../../constants'

export function isCampBuilding(type: string | null | undefined): boolean {
  return type === BUILDING_TYPES.chest || type === BUILDING_TYPES.fireCamp || type === BUILDING_TYPES.trap
}
