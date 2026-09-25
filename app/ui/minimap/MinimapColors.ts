import type { RuntimeCell } from '../../types/map'

const MINIMAP_DARK_FOREST_TERRAIN_COLOR = '#3D5630'

export function terrainColor(cell: RuntimeCell): string {
  if (cell.type === 'DarkForest') return MINIMAP_DARK_FOREST_TERRAIN_COLOR
  return typeof cell.color === 'string' ? cell.color : ''
}
