import { BUILDING_TYPES } from '../../constants'
import type { BuildingEntity } from '../../types/entities'
import type { RuntimeCell, RuntimeMap } from '../../types/map'

type InteriorDefaultBuildingOptions = Partial<
  Pick<BuildingEntity, 'assetType' | 'hitPoints' | 'indestructible' | 'inventory' | 'totalHitPoints'>
>

export type BuildingInteriorDecorationSpec = {
  allowBorderPlacement?: boolean
  buildingOptions?: InteriorDefaultBuildingOptions
  key: string
  offsetI: number
  offsetJ: number
  placement?: 'offset' | 'oppositeExitBorder' | 'oppositeExitInset'
  type: string
}

type DecorationTemplate = Omit<BuildingInteriorDecorationSpec, 'type'> & {
  type: keyof typeof BUILDING_TYPES
}

// Furniture groups follow the room's isometric walls and leave the doorway open.
const DECORATION_LAYOUTS: Record<string, DecorationTemplate[]> = {
  [BUILDING_TYPES.townCenter]: [
    { key: 'firecamp-center', type: 'fireCamp', offsetI: 0, offsetJ: 0, allowBorderPlacement: true },
    {
      key: 'storage-chest',
      type: 'chest',
      offsetI: -5,
      offsetJ: 0,
      allowBorderPlacement: true,
      buildingOptions: { indestructible: true, assetType: 'InteriorMirroredChest' },
    },
    { key: 'bookcase-1', type: 'campBookcase', offsetI: -5, offsetJ: 2, allowBorderPlacement: true },
    { key: 'bookcase-2', type: 'campBookcase', offsetI: -5, offsetJ: -2, allowBorderPlacement: true },
    { key: 'mounted-skull-1', type: 'campMountedSkull', offsetI: -5, offsetJ: 3, allowBorderPlacement: true },
    { key: 'blue-jar-1', type: 'campBlueJar', offsetI: -4, offsetJ: -4, allowBorderPlacement: true },
    { key: 'jar-large-1', type: 'campJarLarge', offsetI: -4, offsetJ: -3, allowBorderPlacement: true },
    { key: 'fruit-bowl-1', type: 'campFruitBowl', offsetI: -3, offsetJ: -4, allowBorderPlacement: true },
    { key: 'brazier-1', type: 'campBrazier', offsetI: -2, offsetJ: -5, allowBorderPlacement: true },
    { key: 'throne-1', type: 'campThrone', offsetI: 0, offsetJ: -5, allowBorderPlacement: true },
    { key: 'brazier-2', type: 'campBrazier', offsetI: 2, offsetJ: -5, allowBorderPlacement: true },
    { key: 'arrow-basket-1', type: 'campArrowBasket', offsetI: 5, offsetJ: -2, allowBorderPlacement: true },
    { key: 'bench-1', type: 'campBench', offsetI: 5, offsetJ: 0, allowBorderPlacement: true },
    { key: 'stump-stool-1', type: 'campStumpStool', offsetI: 5, offsetJ: 3, allowBorderPlacement: true },
    { key: 'torch-stand-1', type: 'campTorchStand', offsetI: 2, offsetJ: 5, allowBorderPlacement: true },
    { key: 'torch-stand-2', type: 'campTorchStand', offsetI: -2, offsetJ: 5, allowBorderPlacement: true },
  ],
  [BUILDING_TYPES.house]: [
    { key: 'firecamp-center', type: 'fireCamp', offsetI: 0, offsetJ: 0, allowBorderPlacement: true },
    { key: 'supply-shelf-1', type: 'campSupplyShelf', offsetI: -4, offsetJ: -1, allowBorderPlacement: true },
    { key: 'jar-large-1', type: 'campJarLarge', offsetI: -4, offsetJ: -2, allowBorderPlacement: true },
    { key: 'arrow-basket-1', type: 'campArrowBasket', offsetI: -3, offsetJ: -3, allowBorderPlacement: true },
    { key: 'screen-1', type: 'campScreen', offsetI: -1, offsetJ: -3, allowBorderPlacement: true },
    { key: 'alchemy-table-1', type: 'campAlchemyTable', offsetI: 1, offsetJ: -4, allowBorderPlacement: true },
    { key: 'stump-stool-1', type: 'campStumpStool', offsetI: 1, offsetJ: -3, allowBorderPlacement: true },
    { key: 'table-1', type: 'campTable', offsetI: -4, offsetJ: 1, allowBorderPlacement: true },
    { key: 'bench-1', type: 'campBench', offsetI: -3, offsetJ: 1, allowBorderPlacement: true },
    { key: 'square-stool-1', type: 'campSquareStool', offsetI: -4, offsetJ: 2, allowBorderPlacement: true },
  ],
  [BUILDING_TYPES.barracks]: [
    { key: 'stump-stool-1', type: 'campStumpStool', offsetI: -5, offsetJ: -3, allowBorderPlacement: true },
    { key: 'forge-1', type: 'campForge', offsetI: -2, offsetJ: -6, allowBorderPlacement: true },
    { key: 'brazier-1', type: 'campBrazier', offsetI: -5, offsetJ: -1, allowBorderPlacement: true },
    { key: 'brazier-2', type: 'campBrazier', offsetI: 2, offsetJ: -3, allowBorderPlacement: true },
    { key: 'torch-stand-1', type: 'campTorchStand', offsetI: -2, offsetJ: 3, allowBorderPlacement: true },
    { key: 'arrow-basket-1', type: 'campArrowBasket', offsetI: 5, offsetJ: -1, allowBorderPlacement: true },
    { key: 'bench-1', type: 'campBench', offsetI: 5, offsetJ: 1, allowBorderPlacement: true },
  ],
  [BUILDING_TYPES.temple]: [
    { key: 'mounted-skull-1', type: 'campMountedSkull', offsetI: -5, offsetJ: -1, allowBorderPlacement: true },
    { key: 'bench-1', type: 'campBench', offsetI: -3, offsetJ: -2, allowBorderPlacement: true },
    { key: 'chair-1', type: 'campChair', offsetI: -1, offsetJ: -3, allowBorderPlacement: true },
    { key: 'bench-2', type: 'campBench', offsetI: -3, offsetJ: 1, allowBorderPlacement: true },
    { key: 'brazier-1', type: 'campBrazier', offsetI: 1, offsetJ: -3, allowBorderPlacement: true },
    { key: 'brazier-2', type: 'campBrazier', offsetI: -2, offsetJ: 3, allowBorderPlacement: true },
    { key: 'bench-3', type: 'campBench', offsetI: 3, offsetJ: -1, allowBorderPlacement: true },
    { key: 'bench-4', type: 'campBench', offsetI: 3, offsetJ: 2, allowBorderPlacement: true },
    { key: 'torch-stand-1', type: 'campTorchStand', offsetI: 5, offsetJ: 1, allowBorderPlacement: true },
  ],
  [BUILDING_TYPES.granary]: [
    {
      key: 'storage-chest',
      type: 'chest',
      offsetI: -1,
      offsetJ: -5,
      allowBorderPlacement: true,
      buildingOptions: { indestructible: true },
    },
    { key: 'jar-large-1', type: 'campJarLarge', offsetI: -5, offsetJ: -4, allowBorderPlacement: true },
    { key: 'apple-basket-1', type: 'campAppleBasket', offsetI: -4, offsetJ: -5, allowBorderPlacement: true },
    { key: 'supply-shelf-1', type: 'campSupplyShelf', offsetI: -5, offsetJ: -2, allowBorderPlacement: true },
    { key: 'jar-small-1', type: 'campJarSmall', offsetI: -4, offsetJ: -4, allowBorderPlacement: true },
    { key: 'supply-shelf-2', type: 'campSupplyShelf', offsetI: -5, offsetJ: -1, allowBorderPlacement: true },
    { key: 'arrow-basket-1', type: 'campArrowBasket', offsetI: -5, offsetJ: 0, allowBorderPlacement: true },
    { key: 'workbench-1', type: 'campWorkbench', offsetI: -3, offsetJ: 0, allowBorderPlacement: true },
    { key: 'blue-jar-1', type: 'campBlueJar', offsetI: 4, offsetJ: -1, allowBorderPlacement: true },
  ],
  [BUILDING_TYPES.storagePit]: [
    {
      key: 'storage-chest',
      type: 'chest',
      offsetI: -1,
      offsetJ: -5,
      allowBorderPlacement: true,
      buildingOptions: { indestructible: true },
    },
    { key: 'supply-shelf-1', type: 'campSupplyShelf', offsetI: -5, offsetJ: -2, allowBorderPlacement: true },
    { key: 'jar-large-1', type: 'campJarLarge', offsetI: -5, offsetJ: -3, allowBorderPlacement: true },
    { key: 'square-stool-1', type: 'campSquareStool', offsetI: -4, offsetJ: -4, allowBorderPlacement: true },
    { key: 'supply-shelf-2', type: 'campSupplyShelf', offsetI: -5, offsetJ: -1, allowBorderPlacement: true },
    { key: 'arrow-basket-1', type: 'campArrowBasket', offsetI: -5, offsetJ: 0, allowBorderPlacement: true },
    { key: 'jar-large-2', type: 'campJarLarge', offsetI: -4, offsetJ: 2, allowBorderPlacement: true },
    { key: 'table-1', type: 'campTable', offsetI: 2, offsetJ: -1, allowBorderPlacement: true },
    { key: 'square-stool-2', type: 'campSquareStool', offsetI: 3, offsetJ: -1, allowBorderPlacement: true },
    { key: 'blue-jar-1', type: 'campBlueJar', offsetI: 5, offsetJ: -1, allowBorderPlacement: true },
    { key: 'jar-small-1', type: 'campJarSmall', offsetI: 5, offsetJ: 0, allowBorderPlacement: true },
  ],
  [BUILDING_TYPES.stable]: [
    { key: 'bucket-1', type: 'campBucket', offsetI: -4, offsetJ: -3, allowBorderPlacement: true },
    { key: 'bucket-2', type: 'campBucket', offsetI: 4, offsetJ: -1, allowBorderPlacement: true },
  ],
  [BUILDING_TYPES.watchTower]: [
    { key: 'chair-1', type: 'campChair', offsetI: -1, offsetJ: -3, allowBorderPlacement: true },
    { key: 'torch-stand-1', type: 'campTorchStand', offsetI: -3, offsetJ: 0, allowBorderPlacement: true },
  ],
}

const DEFAULT_DECORATION_LAYOUT: DecorationTemplate[] = [
  { key: 'crate-nw', type: 'campCrate', offsetI: -3, offsetJ: -2 },
  { key: 'rock-se', type: 'campRockPile', offsetI: 3, offsetJ: 2 },
]

function resolveDecoration(template: DecorationTemplate): BuildingInteriorDecorationSpec {
  return { ...template, type: BUILDING_TYPES[template.type] }
}

export function getBuildingInteriorDecorationLayout(
  building: Pick<BuildingEntity, 'type'>,
  options: { includeFireCamp?: boolean } = {}
): BuildingInteriorDecorationSpec[] {
  if (building.type === BUILDING_TYPES.cave) return []
  const { includeFireCamp = true } = options
  const layout = DECORATION_LAYOUTS[building.type] ?? DEFAULT_DECORATION_LAYOUT
  return layout.filter(item => includeFireCamp || item.type !== 'fireCamp').map(resolveDecoration)
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
    mirrored?: boolean
    searchRadius?: number
  } = {}
): RuntimeCell | null {
  const {
    mirrored = false,
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
    if (cells.length) {
      // Keep furniture near its intended group, independent of the world's random seed.
      cells.sort(
        (a, b) =>
          (a.i - preferred.i) ** 2 + (a.j - preferred.j) ** 2 - ((b.i - preferred.i) ** 2 + (b.j - preferred.j) ** 2) ||
          (mirrored ? a.j - b.j || a.i - b.i : a.i - b.i || a.j - b.j)
      )
      return cells[0]
    }
  }
  return null
}
