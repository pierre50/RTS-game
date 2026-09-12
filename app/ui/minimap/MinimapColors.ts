import type { ResourceEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'

const MINIMAP_DARK_FOREST_TERRAIN_COLOR = '#3D5630'
const MINIMAP_DARK_FOREST_TREE_COLOR = '#122A12'

export function terrainColor(cell: RuntimeCell): string {
  if (cell.type === 'DarkForest') return MINIMAP_DARK_FOREST_TERRAIN_COLOR
  return typeof cell.color === 'string' ? cell.color : ''
}

function isDarkForestTree(resource: ResourceEntity): boolean {
  return resource.type === 'Tree' && (resource.textureName?.includes('/dark-forest') || resource.currentCell?.type === 'DarkForest')
}

export function resourceColor(resource: ResourceEntity): string {
  if (isDarkForestTree(resource)) return MINIMAP_DARK_FOREST_TREE_COLOR
  return resource.color ?? ''
}

