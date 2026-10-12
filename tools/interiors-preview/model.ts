import { getInteriorLayoutLevel } from '../../app/lib/buildings/interiorLayoutLevel'
export { getInteriorLayoutLevel }
import { getInteriorRoomSize, INTERIOR_ROOM_SIZES } from '../../app/lib/buildings/interiorRoomSize'
export { INTERIOR_ROOM_SIZES }
import { INTERIOR_FURNITURE_CATEGORIES } from '../../app/lib/buildings/furniture/interiorFurnitureCatalog'
import {
  INTERIOR_LAYOUT_POSITIONS,
  type InteriorLayoutPositions,
  type InteriorFurnitureLayout,
} from '../../app/config/interiorLayoutPositions'
import { getInteriorFurniturePlacementError } from '../../app/lib/buildings/furniture/interiorFurniturePlacement'
import definitions from '../../public/assets/data/gameplay/buildings.json'
import { getBuildingLevels, getBuildingConfigForLevel } from '../../app/lib/buildings/buildingLevel'
import { createDefaultBuildingInteriorBlueprint } from '../../engine/services/BuildingInteriorSpaceLayout'
import { mirrorInteriorBlueprint } from '../../app/lib/buildings/interiorOrientation'
import { ensureInteriorDefaultBuildings } from '../../engine/services/BuildingInteriorSpaceDecorations'
import { getBuildingFootprintCells } from '../../app/lib/grid/cells'
import { isBuildingTraversable } from '../../app/lib/buildings/buildingTraversal'
import { getBuildingAsset } from '../../app/lib/graphics/assets'
import { getInteriorWallGeometry } from '../../app/lib/terrain/interiorWallGeometry'
import { createInteriorWallOcclusionCheck } from '../../app/lib/terrain/interiorWallOcclusion'
import { getInteriorFloorDecorations } from '../../app/lib/buildings/furniture/interiorFloorDecorations'
import { getInteriorRoomCenter } from '../../app/lib/buildings/furniture/interiorFurniturePlacement'
import { BUILDING_INTERIOR_TYPES } from '../../app/lib/buildings/interiorProfiles'

export const furnitureCatalog = INTERIOR_FURNITURE_CATEGORIES

const labels = {
  House: 'Maison',
  TownCenter: 'Town Center',
  Barracks: 'Caserne',
  Temple: 'Temple',
  Granary: 'Grenier',
  StoragePit: 'Dépôt',
  Stable: 'Écurie',
  WatchTower: 'Tour de guet',
}
export const buildings = [...BUILDING_INTERIOR_TYPES]
  .filter(type => type !== 'Cave')
  .map(type => ({ type, name: labels[type] ?? type, levels: getBuildingLevels(definitions[type]) }))

/** Lightweight scene host: the game computes geometry, footprints and furnishing placement. */
export function sceneFor(type: string, buildingLevel: number, mirrored: boolean, furnished: boolean) {
  const config = getBuildingConfigForLevel(definitions[type], buildingLevel)
  const building = {
    type,
    buildingLevel,
    size: config.size,
    placementMirrored: mirrored,
    interiorUnfurnished: !furnished,
  }
  const source = createDefaultBuildingInteriorBlueprint(building as never)
  const bp = mirrored ? mirrorInteriorBlueprint(source) : source
  const grid = Array.from({ length: bp.size + 1 }, (_, i) =>
    Array.from({ length: bp.size + 1 }, (_, j) => ({
      i,
      j,
      x: (i - j) * 32,
      y: (i + j) * 16,
      z: 0,
      category: bp.floorMask[i]?.[j] ? 'Ground' : 'Water',
      has: null,
      border: Boolean(bp.borderMask[i]?.[j]),
      solid: !bp.floorMask[i]?.[j],
      terrainHidden: !bp.floorMask[i]?.[j],
      waterBorder: false,
    }))
  )
  const owner = {
    type: furnished ? 'AI' : 'Human',
    isPlayed: !furnished,
    buildings: [],
    config: { buildings: definitions },
    createBuilding(options) {
      const item = { ...options, isDestroyed: false }
      this.buildings.push(item)
      for (const cell of getBuildingFootprintCells(
        item.i,
        item.j,
        grid as never,
        definitions[item.type].size,
        undefined,
        item.type
      )) {
        cell.has = item
        cell.solid = !isBuildingTraversable(item.type)
      }
      return item
    },
  }
  const exit = bp.exits[0]
  const cells = grid.flat().filter(cell => !cell.terrainHidden && !cell.border)
  const space = {
    id: `preview:${type}`,
    size: bp.size,
    grid,
    building: { ...building, owner },
    walkableCells: cells,
    sleepCells: cells,
    entryCell: grid[exit.i][exit.j],
    exitCell: grid[exit.i][exit.j],
  }
  ensureInteriorDefaultBuildings({ map: { randomItem: items => items[0] } } as never, space as never)
  const occludes = createInteriorWallOcclusionCheck(bp)
  const walls = bp.walls
    .filter(w => bp.floorMask[w.i]?.[w.j] && !(w.i === exit.i && w.j === exit.j))
    .map(w => {
      const geometry = getInteriorWallGeometry(bp, w)
      return { ...geometry, low: w.side >= 2 || occludes(geometry) }
    })
  const furniture = owner.buildings.map(item => ({
    ...item,
    asset: getBuildingAsset(item.assetType || item.type, {}, {} as never),
    depth: item.i + item.j + (definitions[item.type].zIndexOffset ?? 0),
  }))
  return {
    bp,
    roomSize: getInteriorRoomSize(building),
    hasAuthoredRoomSize:
      (INTERIOR_LAYOUT_POSITIONS[type]?.[getInteriorLayoutLevel(building)] as InteriorFurnitureLayout)?.roomSize !==
      undefined,
    grid,
    walls,
    furniture,
    center: getInteriorRoomCenter(space as never),
    hasAuthoredRugs: Boolean(
      (INTERIOR_LAYOUT_POSITIONS[type]?.[getInteriorLayoutLevel(building)] as InteriorFurnitureLayout)?.rugs !==
        undefined
    ),
    rugs: furnished ? structuredClone([...getInteriorFloorDecorations(type, buildingLevel)]) : [],
    building,
  }
}

export function replacePositions(positions: InteriorLayoutPositions) {
  for (const key of Object.keys(INTERIOR_LAYOUT_POSITIONS)) delete INTERIOR_LAYOUT_POSITIONS[key]
  Object.assign(INTERIOR_LAYOUT_POSITIONS, structuredClone(positions))
}

export function authoredPositions(scene: ReturnType<typeof sceneFor>) {
  return Object.fromEntries(
    scene.furniture.map(item => {
      const di = item.i - scene.center.i,
        dj = item.j - scene.center.j
      return [
        item.label.split(':default:')[1],
        {
          offsetI: scene.building.placementMirrored ? dj : di,
          offsetJ: scene.building.placementMirrored ? di : dj,
        },
      ]
    })
  )
}

/** Preview edits do not touch persisted layouts until the save action succeeds. */
export function moveFurniture(scene: ReturnType<typeof sceneFor>, label: string, i: number, j: number): string | null {
  const item = scene.furniture.find(item => item.label === label)
  if (!item || !Number.isInteger(i) || !Number.isInteger(j)) return 'Sélectionne un meuble.'
  const size = definitions[item.type].size
  const door = scene.bp.exits[0]
  const placementError = getInteriorFurniturePlacementError(
    scene.grid as never,
    { i, j, size, type: item.type, label },
    [door]
  )
  if (placementError) return placementError
  const old = { i: item.i, j: item.j }
  const occupy = (i: number, j: number) => {
    for (const cell of scene.grid.flat())
      if (cell.has?.label === label) {
        cell.has = null
        cell.solid = cell.terrainHidden
      }
    item.i = i
    item.j = j
    item.depth = i + j + (definitions[item.type].zIndexOffset ?? 0)
    for (const cell of getBuildingFootprintCells(i, j, scene.grid as never, size, undefined, item.type)) {
      cell.has = item
      cell.solid = !isBuildingTraversable(item.type)
    }
  }
  occupy(i, j)
  // Require all open, non-border floor cells to remain reachable from the doorway.
  const reachable = new Set<string>(),
    queue = [scene.grid[door.i][door.j]]
  const open = cell =>
    cell && !cell.terrainHidden && !cell.solid && (!cell.border || (cell.i === door.i && cell.j === door.j))
  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index],
      key = `${cell.i}:${cell.j}`
    if (reachable.has(key)) continue
    reachable.add(key)
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const next = scene.grid[cell.i + di]?.[cell.j + dj]
      if (open(next) && !reachable.has(`${next.i}:${next.j}`)) queue.push(next)
    }
  }
  if (scene.grid.flat().some(cell => open(cell) && !reachable.has(`${cell.i}:${cell.j}`))) {
    occupy(old.i, old.j)
    return 'Ce placement coupe la circulation dans la pièce.'
  }
  return null
}

/** Full layouts record deletions by absence; legacy offset-only files remain readable. */
export function authoredLayout(scene: ReturnType<typeof sceneFor>): InteriorFurnitureLayout {
  const positions = authoredPositions(scene)
  return {
    ...(scene.hasAuthoredRoomSize ? { roomSize: scene.roomSize } : {}),
    ...(scene.rugs.length || scene.hasAuthoredRugs ? { rugs: structuredClone(scene.rugs) } : {}),
    items: Object.fromEntries(
      scene.furniture.map(item => {
        const key = item.label.split(':default:')[1]
        return [
          key,
          {
            ...positions[key],
            type: item.type,
            mirrored: Boolean(item.placementMirrored) !== Boolean(scene.building.placementMirrored),
          },
        ]
      })
    ),
  }
}

export function sceneWithLayout(scene: ReturnType<typeof sceneFor>, layout: InteriorFurnitureLayout) {
  const persisted = structuredClone(INTERIOR_LAYOUT_POSITIONS)
  try {
    const candidate = structuredClone(persisted)
    candidate[scene.building.type] ??= {}
    candidate[scene.building.type][getInteriorLayoutLevel(scene.building)] = layout
    replacePositions(candidate)
    const next = sceneFor(scene.building.type, scene.building.buildingLevel, scene.building.placementMirrored, true)
    // Keep every draft item, including those outside a reduced room, until the user fixes it.
    next.furniture = Object.entries(layout.items).map(([key, item]) => {
      const label = `preview:${scene.building.type}:default:${key}`
      const original = next.furniture.find(f => f.label === label) ?? scene.furniture.find(f => f.label === label)
      const i = next.center.i + (scene.building.placementMirrored ? item.offsetJ : item.offsetI)
      const j = next.center.j + (scene.building.placementMirrored ? item.offsetI : item.offsetJ)
      return {
        ...original,
        label,
        type: item.type,
        i,
        j,
        placementMirrored: Boolean(scene.building.placementMirrored) !== item.mirrored,
        asset: original?.asset ?? getBuildingAsset(item.type, {}, {} as never),
        depth: i + j + (definitions[item.type].zIndexOffset ?? 0),
      }
    })
    for (const cell of next.grid.flat()) {
      cell.has = null
      cell.solid = cell.terrainHidden
    }
    for (const item of next.furniture)
      for (const cell of furnitureFootprint(next, item)) {
        cell.has = item
        cell.solid = cell.terrainHidden || !isBuildingTraversable(item.type)
      }
    return next
  } finally {
    replacePositions(persisted)
  }
}

export function editFurniture(scene: ReturnType<typeof sceneFor>, layout: InteriorFurnitureLayout) {
  const candidate = sceneWithLayout(scene, layout)
  for (const rug of editableItems(candidate).filter(item => item.label.startsWith('floor:'))) {
    const error = moveEditable(candidate, rug.label, rug.i, rug.j)
    if (error) throw new Error(error)
  }
  const actual = authoredLayout(candidate).items
  if (
    Object.keys(actual).length !== Object.keys(layout.items).length ||
    Object.entries(layout.items).some(
      ([key, item]) =>
        !actual[key] || ['type', 'mirrored', 'offsetI', 'offsetJ'].some(field => actual[key][field] !== item[field])
    )
  )
    throw new Error('Cet emplacement ne laisse pas assez de place pour les meubles. Choisis une autre case.')
  for (const item of candidate.furniture) {
    const error = moveFurniture(candidate, item.label, item.i, item.j)
    if (error) throw new Error(error)
  }
  return candidate
}

export function furnitureFootprint(scene: ReturnType<typeof sceneFor>, item: { i: number; j: number; type: string }) {
  return getBuildingFootprintCells(item.i, item.j, scene.grid, definitions[item.type].size, undefined, item.type)
}

/** Floor decorations are selectable but never reserve cells or block furniture. */
export function editableItems(scene: ReturnType<typeof sceneFor>) {
  return [
    ...scene.furniture,
    ...scene.rugs.map((rug, index) => {
      const x = rug.offsetX * (scene.building.placementMirrored ? -1 : 1)
      const type = { 17: 'CampHide', 18: 'CampRug', 41: 'CampFur' }[rug.frame]
      return {
        label: `floor:${index}`,
        type,
        i: scene.center.i + (x / 32 + rug.offsetY / 16) / 2,
        j: scene.center.j + (rug.offsetY / 16 - x / 32) / 2,
        asset: getBuildingAsset(type, {}, {} as never),
        depth: -Infinity,
        placementMirrored: Boolean(scene.building.placementMirrored) !== Boolean(rug.mirrored),
      }
    }),
  ]
}

export function moveEditable(scene: ReturnType<typeof sceneFor>, label: string, i: number, j: number): string | null {
  if (!label.startsWith('floor:')) return moveFurniture(scene, label, i, j)
  const rug = scene.rugs[Number(label.slice(6))]
  if (!rug || !Number.isFinite(i) || !Number.isFinite(j)) return 'Sélectionne un tapis.'
  const cell = scene.grid[Math.round(i)]?.[Math.round(j)]
  if (!cell || cell.terrainHidden || cell.category === 'Water' || (cell.border && !rug.allowBorderPlacement))
    return 'Le centre du tapis doit rester sur le sol de la pièce.'
  rug.offsetX = (i - scene.center.i - (j - scene.center.j)) * 32 * (scene.building.placementMirrored ? -1 : 1)
  rug.offsetY = (i - scene.center.i + (j - scene.center.j)) * 16
  scene.hasAuthoredRugs = true
  return null
}

export function layoutIssues(scene: ReturnType<typeof sceneFor>): string[] {
  const issues: string[] = []
  for (const item of editableItems(scene)) {
    if (item.label.startsWith('floor:')) {
      const cell = scene.grid[Math.round(item.i)]?.[Math.round(item.j)]
      const rug = scene.rugs[Number(item.label.slice(6))]
      if (!cell || cell.terrainHidden || (cell.border && !rug.allowBorderPlacement))
        issues.push(`${item.type} (sol) : hors de la pièce`)
    } else {
      const error = getInteriorFurniturePlacementError(
        scene.grid as never,
        { ...item, size: definitions[item.type].size },
        scene.bp.exits
      )
      if (error) issues.push(`${item.type} : ${error}`)
    }
  }
  return issues
}
