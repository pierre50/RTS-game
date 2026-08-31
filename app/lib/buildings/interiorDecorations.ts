import { BUILDING_TYPES } from '../../constants'
import type { BuildingEntity } from '../../types/entities'
import type { RuntimeCell, RuntimeMap } from '../../types/map'

type InteriorDefaultBuildingOptions = Partial<
  Pick<BuildingEntity, 'hitPoints' | 'indestructible' | 'inventory' | 'totalHitPoints'>
>

export type BuildingInteriorDecorationSpec = {
  allowBorderPlacement?: boolean
  buildingOptions?: InteriorDefaultBuildingOptions
  key: string
  offsetI: number
  offsetJ: number
  placement?: 'offset' | 'oppositeExitBorder'
  type: string
}

type DecorationTemplate = Omit<BuildingInteriorDecorationSpec, 'type'> & {
  type: keyof typeof BUILDING_TYPES
}

const DECORATION_LAYOUTS: Record<string, DecorationTemplate[]> = {
  [BUILDING_TYPES.townCenter]: [
    {
      key: 'storage-chest',
      type: 'chest',
      offsetI: 0,
      offsetJ: 0,
      placement: 'oppositeExitBorder',
      allowBorderPlacement: true,
      buildingOptions: { indestructible: true },
    },
  ],
  [BUILDING_TYPES.stable]: [
    { key: 'bucket-west', type: 'campBucket', offsetI: -2, offsetJ: 1 },
    { key: 'drying-rack-east', type: 'campDryingRack', offsetI: 3, offsetJ: -1 },
  ],
  [BUILDING_TYPES.house]: [{ key: 'jar-se', type: 'campJarSmall', offsetI: 2, offsetJ: 1 }],
  [BUILDING_TYPES.barracks]: [
    { key: 'crate-west', type: 'campCrate', offsetI: -3, offsetJ: 0 },
    { key: 'totem-north', type: 'campTotemPlain', offsetI: 0, offsetJ: -3 },
  ],
  [BUILDING_TYPES.archeryRange]: [
    { key: 'fence-west', type: 'campFencePost', offsetI: -3, offsetJ: 1 },
    { key: 'drying-rack-east', type: 'campDryingRack', offsetI: 3, offsetJ: 0 },
  ],
  [BUILDING_TYPES.temple]: [
    { key: 'totem-center', type: 'campTotemHorns', offsetI: 0, offsetJ: -1 },
    { key: 'jar-west', type: 'campJarLarge', offsetI: -2, offsetJ: 2 },
    { key: 'jar-east', type: 'campJarSmall', offsetI: 2, offsetJ: 2 },
  ],
  [BUILDING_TYPES.market]: [
    { key: 'crate-nw', type: 'campCrate', offsetI: -2, offsetJ: -2 },
    { key: 'jar-se', type: 'campJarLarge', offsetI: 2, offsetJ: 2 },
  ],
  [BUILDING_TYPES.granary]: [
    {
      key: 'storage-chest',
      type: 'chest',
      offsetI: 0,
      offsetJ: 0,
      placement: 'oppositeExitBorder',
      allowBorderPlacement: true,
      buildingOptions: { indestructible: true },
    },
    { key: 'bucket-west', type: 'campBucket', offsetI: -2, offsetJ: 1 },
    { key: 'drying-rack-east', type: 'campDryingRack', offsetI: 2, offsetJ: -1 },
  ],
  [BUILDING_TYPES.storagePit]: [
    {
      key: 'storage-chest',
      type: 'chest',
      offsetI: 0,
      offsetJ: 0,
      placement: 'oppositeExitBorder',
      allowBorderPlacement: true,
      buildingOptions: { indestructible: true },
    },
    { key: 'crate-west', type: 'campCrate', offsetI: -2, offsetJ: 0 },
    { key: 'rock-east', type: 'campRockPile', offsetI: 2, offsetJ: 1 },
  ],
  [BUILDING_TYPES.watchTower]: [
    { key: 'skull-north', type: 'campSkull', offsetI: 0, offsetJ: -2 },
    { key: 'crate-south', type: 'campCrate', offsetI: 0, offsetJ: 2 },
  ],
}

const DEFAULT_DECORATION_LAYOUT: DecorationTemplate[] = [
  { key: 'crate-nw', type: 'campCrate', offsetI: -3, offsetJ: -2 },
  { key: 'rock-se', type: 'campRockPile', offsetI: 3, offsetJ: 2 },
]

const WITHOUT_FIRE_CAMP = new Set<string>([
  BUILDING_TYPES.granary,
  BUILDING_TYPES.stable,
  BUILDING_TYPES.storagePit,
  BUILDING_TYPES.temple,
  BUILDING_TYPES.watchTower,
])

function resolveDecoration(template: DecorationTemplate): BuildingInteriorDecorationSpec {
  return { ...template, type: BUILDING_TYPES[template.type] }
}

function shouldIncludeFireCamp(buildingType: string, includeFireCamp: boolean): boolean {
  return includeFireCamp && !WITHOUT_FIRE_CAMP.has(buildingType)
}

export function getBuildingInteriorDecorationLayout(
  building: Pick<BuildingEntity, 'type'>,
  options: { includeFireCamp?: boolean } = {}
): BuildingInteriorDecorationSpec[] {
  const { includeFireCamp = true } = options
  const layout = DECORATION_LAYOUTS[building.type] ?? DEFAULT_DECORATION_LAYOUT
  const base = shouldIncludeFireCamp(building.type, includeFireCamp)
    ? [{ key: 'firecamp-center', type: BUILDING_TYPES.fireCamp, offsetI: 0, offsetJ: 0 }]
    : []
  return [...base, ...layout.map(resolveDecoration)]
}

export function interiorCellKey(cell: Pick<RuntimeCell, 'i' | 'j'>): string {
  return `${cell.i}:${cell.j}`
}

function isInteriorDecorationFloorCell(cell: RuntimeCell | null | undefined): cell is RuntimeCell {
  return Boolean(cell && !cell.has && !cell.solid && !cell.border && cell.category !== 'Water' && !cell.terrainHidden)
}

export function findInteriorDecorationCell(
  map: Pick<RuntimeMap, 'grid' | 'size'> & { randomItem?: RuntimeMap['randomItem'] },
  preferred: Pick<RuntimeCell, 'i' | 'j'>,
  options: {
    blockedCells?: Set<string>
    canUseCell?: (cell: RuntimeCell | null | undefined) => cell is RuntimeCell
    searchRadius?: number
  } = {}
): RuntimeCell | null {
  const {
    blockedCells = new Set<string>(),
    canUseCell = isInteriorDecorationFloorCell,
    searchRadius = Math.max(3, Math.floor(map.size / 2)),
  } = options
  const isAvailable = (cell: RuntimeCell | null | undefined): cell is RuntimeCell =>
    Boolean(cell && !blockedCells.has(interiorCellKey(cell)) && canUseCell(cell))

  const directCell = map.grid[preferred.i]?.[preferred.j]
  if (isAvailable(directCell)) return directCell

  for (let radius = 1; radius <= searchRadius; radius += 1) {
    const cells: RuntimeCell[] = []
    for (let i = preferred.i - radius; i <= preferred.i + radius; i += 1) {
      for (let j = preferred.j - radius; j <= preferred.j + radius; j += 1) {
        const cell = map.grid[i]?.[j]
        if (isAvailable(cell)) cells.push(cell)
      }
    }
    if (cells.length) return map.randomItem?.(cells) ?? cells[0]
  }
  return null
}
