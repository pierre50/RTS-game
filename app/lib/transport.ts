import { ACTION_TYPES, FAMILY_TYPES, SHEET_TYPES, UNIT_TYPES } from '../constants'
import { getCellsAroundPoint } from './grid/cells'
import { getInstancePath } from './grid/movement'
import { getInstanceZIndex, instancesDistance } from './maths'
import { updateInstanceVisibility, type RenderableInstance } from './grid/visibility'
import type { Grid, GridPosition, Point } from '../types/grid'
import type { RuntimeEntity } from '../types/entities'
import type { GameContextLike } from '../types/context'
import type { RuntimeCell } from '../types/map'

const SHORE_SEARCH_RADIUS = 4
const UNLOAD_SEARCH_RADIUS = 8

export type TransportCell = RuntimeCell

export type TransportMap = {
  addChild: (unit: RuntimeEntity) => RuntimeEntity
  addToInstanceBucket: (unit: RuntimeEntity) => void
  grid: Grid<TransportCell>
  removeFromInstanceBucket: (unit: RuntimeEntity) => void
}

export type TransportOwner = {
  isPlayed?: boolean
  label?: string
  selectedUnit?: RuntimeEntity | null
  selectedUnits?: RuntimeEntity[]
}

type TransportContext = {
  map?: TransportMap
  player?: TransportOwner
}

type TransportAIContext = {
  map: { grid: Grid<TransportCell> }
  player?: TransportOwner | null
}

export type TransportUnit = GridPosition &
  Partial<Point> & {
    action?: string | null
    category?: string
    context?: GameContextLike | TransportContext | TransportAIContext
    currentCell?: RuntimeCell | null
    die?: () => void
    dest?: TransportUnit | TransportCell | RuntimeEntity | null
    eventMode?: string
    family?: string
    handleChangeDest?: () => void
    inactif?: boolean
    isDead?: boolean
    isDestroyed?: boolean
    label?: string
    loadedInTransport?: TransportBoat | RuntimeEntity | string | null
    owner?: TransportOwner | null
    parent?: object | null
    path?: TransportCell[]
    realDest?: (GridPosition & Partial<Point>) | TransportUnit | TransportCell | RuntimeEntity | null
    sendToWithCell?: (transport: RuntimeEntity, cell: RuntimeCell, action: string) => boolean | void
    setTextures?: (sheet: string) => void
    stopInterval?: () => void
    transportLoadCoastCell?: TransportCell | null
    transportLoadShoreCell?: TransportCell | null
    transportCapacity?: number
    transportedUnits?: TransportUnit[]
    type?: string
    unselect?: () => void
    visible?: boolean
    z?: number | null
    zIndex?: number
  }

export type TransportBoat = TransportUnit & {
  currentCell?: TransportCell | null
  selected?: boolean
  sendTo?: (cell: TransportCell) => void
}

type RuntimeTransportUnit = TransportUnit & RuntimeEntity & RenderableInstance

function runtimeTransportUnit(unit: TransportUnit): RuntimeTransportUnit {
  return unit as RuntimeTransportUnit
}

function isLoadShoreCell(cell?: TransportCell): boolean {
  return cell?.category !== 'Water' && !cell?.waterBorder && !cell?.solid && !cell?.border && !cell?.inclined
}

function isTransportCoastCell(cell?: TransportCell): boolean {
  return !!(cell?.category === 'Water' || cell?.waterBorder) && !cell?.solid
}

function getCellsAtDistance(
  startX: number,
  startY: number,
  grid: Grid<TransportCell>,
  distance: number,
  callback?: (cell: TransportCell) => boolean
): TransportCell[] {
  const result: TransportCell[] = []
  if (distance === 0) {
    const cell = grid[startX]?.[startY]
    if (cell && (!callback || callback(cell))) result.push(cell)
    return result
  }

  for (let dx = -distance; dx <= distance; dx++) {
    const x = startX + dx
    const row = grid[x]
    if (!row) continue
    const dyMax = distance - Math.abs(dx)
    for (const dy of dyMax === 0 ? [0] : [-dyMax, dyMax]) {
      const cell = row[startY + dy]
      if (cell && (!callback || callback(cell))) result.push(cell)
    }
  }
  return result
}

function getTransportContext(unit?: TransportUnit | null): TransportContext | null {
  const context = unit?.context
  return typeof context === 'object' && context !== null ? (context as TransportContext) : null
}

function getTransportMap(unit?: TransportUnit | null): TransportMap | null {
  return getTransportContext(unit)?.map ?? null
}

function getTransportPlayer(unit?: TransportUnit | null): TransportOwner | null {
  return getTransportContext(unit)?.player ?? null
}

function placeTransportUnit(cell: TransportCell, unit: TransportUnit): void {
  cell.place(runtimeTransportUnit(unit))
}

function removeTransportUnitFromParent(unit: TransportUnit): void {
  const parent = unit.parent as { removeChild?: (unit: TransportUnit) => void } | null | undefined
  parent?.removeChild?.(unit)
}

function sendTransportUnitToCell(unit: TransportUnit, transport: TransportBoat, cell: TransportCell): boolean {
  return Boolean(unit.sendToWithCell?.(runtimeTransportUnit(transport), cell, ACTION_TYPES.loadTransport))
}

function sendTransportToCoastCell(transport: TransportBoat, cell: TransportCell): void {
  transport.sendTo?.(cell)
}

export function isTransportBoat(unit?: TransportUnit | null): unit is TransportBoat {
  return Boolean(unit?.family === FAMILY_TYPES.unit && (unit.transportCapacity ?? 0) > 0)
}

export function getTransportCargo(transport: TransportBoat): TransportUnit[] {
  if (!Array.isArray(transport.transportedUnits)) transport.transportedUnits = []
  return transport.transportedUnits
}

export function getTransportLoad(transport: TransportBoat): number {
  return getTransportCargo(transport).filter(unit => unit && !unit.isDead && !unit.isDestroyed).length
}

function hasTransportSpace(transport?: TransportUnit | null): transport is TransportBoat {
  return isTransportBoat(transport) && getTransportLoad(transport) < (transport.transportCapacity ?? 0)
}

export function canUnloadTransport(transport?: TransportUnit | null): transport is TransportBoat {
  return isTransportBoat(transport) && getTransportLoad(transport) > 0 && Boolean(transport.currentCell?.waterBorder)
}

export function canUnitEnterTransport(
  unit?: TransportUnit | null,
  transport?: TransportUnit | null
): transport is TransportBoat {
  return Boolean(
    unit &&
      transport &&
      unit !== transport &&
      !unit.isDead &&
      !unit.isDestroyed &&
      unit.family === FAMILY_TYPES.unit &&
      unit.owner?.label === transport.owner?.label &&
      unit.category !== 'Boat' &&
      unit.type !== UNIT_TYPES.fishingBoat &&
      hasTransportSpace(transport)
  )
}

export function findLoadShoreCell(unit?: TransportUnit | null, transport?: TransportUnit | null): TransportCell | null {
  const map = getTransportMap(transport)
  if (!unit || !transport || !map) return null
  const { grid } = map
  const candidates = getCellsAroundPoint(transport.i, transport.j, grid, SHORE_SEARCH_RADIUS, isLoadShoreCell)
  candidates.sort((a, b) => instancesDistance(unit, a) - instancesDistance(unit, b))
  for (const cell of candidates) {
    if (unit.i === cell.i && unit.j === cell.j) return cell
    if (getInstancePath(unit, cell.i, cell.j, map).length) return cell
  }
  const maxSearchDistance = grid.length + (grid[0]?.length || 0)
  for (let distance = 0; distance <= maxSearchDistance; distance++) {
    const unitCandidates = getCellsAtDistance(unit.i, unit.j, grid, distance, isLoadShoreCell)
    for (const cell of unitCandidates) {
      if (!findTransportCoastCell(transport, cell)) continue
      if (unit.i === cell.i && unit.j === cell.j) return cell
      if (getInstancePath(unit, cell.i, cell.j, map).length) return cell
    }
  }
  return null
}

export function findTransportCoastCell(
  transport?: TransportUnit | null,
  shoreCell?: TransportCell | null
): TransportCell | null {
  const map = getTransportMap(transport)
  if (!transport || !map || !shoreCell) return null
  const { grid } = map
  const candidates = getCellsAroundPoint(shoreCell.i, shoreCell.j, grid, 1, isTransportCoastCell)
  candidates.sort((a, b) => instancesDistance(transport, a) - instancesDistance(transport, b))
  for (const cell of candidates) {
    if (transport.i === cell.i && transport.j === cell.j) return cell
    if (getInstancePath(transport, cell.i, cell.j, map).length) return cell
  }
  return null
}

function findUnloadCell(transport?: TransportUnit | null, unit: TransportUnit | null = null): TransportCell | null {
  const map = getTransportMap(transport)
  if (!transport || !map) return null
  const { grid } = map
  for (let distance = 1; distance <= UNLOAD_SEARCH_RADIUS; distance++) {
    const candidates = getCellsAroundPoint(
      transport.i,
      transport.j,
      grid,
      distance,
      cell => cell.category !== 'Water' && !cell.waterBorder && !cell.solid && !cell.border && !cell.inclined
    )
    if (!candidates.length) continue
    candidates.sort((a, b) => {
      const da = instancesDistance(transport, a)
      const db = instancesDistance(transport, b)
      if (da !== db) return da - db
      return unit ? instancesDistance(unit, a) - instancesDistance(unit, b) : 0
    })
    return candidates[0]
  }
  return null
}

export function boardTransport(unit?: TransportUnit | null, transport?: TransportUnit | null): boolean {
  if (!unit || !canUnitEnterTransport(unit, transport)) return false
  const map = getTransportMap(unit)
  if (!map) return false
  const cargo = getTransportCargo(transport)
  cargo.push(unit)
  unit.stopInterval?.()
  unit.handleChangeDest?.()
  unit.path = []
  unit.action = null
  unit.dest = null
  unit.realDest = null
  unit.transportLoadShoreCell = null
  unit.transportLoadCoastCell = null
  unit.inactif = true
  unit.loadedInTransport = transport
  unit.visible = false
  unit.eventMode = 'none'
  unit.unselect?.()
  const player = getTransportPlayer(unit)
  if (player?.selectedUnit === unit) player.selectedUnit = null
  if (Array.isArray(player?.selectedUnits)) {
    const selectedIndex = player.selectedUnits.indexOf(runtimeTransportUnit(unit))
    if (selectedIndex >= 0) player.selectedUnits.splice(selectedIndex, 1)
  }
  if (unit.currentCell?.has === unit) {
    unit.currentCell.has = null
    unit.currentCell.solid = false
  }
  unit.currentCell = null
  map.removeFromInstanceBucket(runtimeTransportUnit(unit))
  removeTransportUnitFromParent(unit)
  return true
}

export function unloadTransport(transport?: TransportUnit | null): number {
  if (!canUnloadTransport(transport)) return 0
  const map = getTransportMap(transport)
  if (!map) return 0
  const cargo = getTransportCargo(transport)
  let unloaded = 0
  for (const unit of [...cargo]) {
    if (!unit || unit.isDead || unit.isDestroyed) continue
    const cell = findUnloadCell(transport, unit)
    if (!cell) break
    const index = cargo.indexOf(unit)
    if (index >= 0) cargo.splice(index, 1)
    unit.loadedInTransport = null
    unit.i = cell.i
    unit.j = cell.j
    unit.x = cell.x ?? unit.x
    unit.y = cell.y ?? unit.y
    unit.z = cell.z ?? unit.z ?? 0
    unit.zIndex = getInstanceZIndex({ x: unit.x ?? 0, y: unit.y ?? 0, z: unit.z })
    unit.currentCell = cell
    placeTransportUnit(cell, unit)
    cell.solid = true
    unit.eventMode = 'static'
    unit.visible = true
    map.addChild(runtimeTransportUnit(unit))
    map.addToInstanceBucket(runtimeTransportUnit(unit))
    unit.setTextures?.(SHEET_TYPES.standing)
    updateInstanceVisibility(runtimeTransportUnit(unit))
    unloaded++
  }
  return unloaded
}

export function sendUnitToTransport(unit?: TransportUnit | null, transport?: TransportUnit | null): boolean {
  if (!unit || !canUnitEnterTransport(unit, transport)) return false
  const shoreCell = findLoadShoreCell(unit, transport)
  if (!shoreCell) return false
  const coastCell = findTransportCoastCell(transport, shoreCell)
  unit.transportLoadShoreCell = shoreCell
  unit.transportLoadCoastCell = coastCell
  if (coastCell) sendTransportToCoastCell(transport, coastCell)
  return sendTransportUnitToCell(unit, transport, shoreCell)
}
