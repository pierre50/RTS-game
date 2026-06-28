import { ACTION_TYPES, FAMILY_TYPES, UNIT_TYPES } from '../constants'
import { getCellsAroundPoint } from './grid/cells'
import { getInstancePath } from './grid/movement'
import { getInstanceZIndex, instancesDistance } from './maths'
import { updateInstanceVisibility } from './grid/visibility'

const SHORE_SEARCH_RADIUS = 4
const UNLOAD_SEARCH_RADIUS = 8

export function isTransportBoat(unit) {
  return Boolean(unit?.family === FAMILY_TYPES.unit && unit.transportCapacity > 0)
}

export function getTransportCargo(transport) {
  if (!Array.isArray(transport.transportedUnits)) transport.transportedUnits = []
  return transport.transportedUnits
}

export function getTransportLoad(transport) {
  return getTransportCargo(transport).filter(unit => unit && !unit.isDead && !unit.isDestroyed).length
}

export function hasTransportSpace(transport) {
  return isTransportBoat(transport) && getTransportLoad(transport) < transport.transportCapacity
}

export function canUnitEnterTransport(unit, transport) {
  return (
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

export function findLoadShoreCell(unit, transport) {
  if (!unit || !transport?.context?.map) return null
  const { grid } = transport.context.map
  const candidates = getCellsAroundPoint(
    transport.i,
    transport.j,
    grid,
    SHORE_SEARCH_RADIUS,
    cell => cell.category !== 'Water' && !cell.waterBorder && !cell.solid && !cell.border && !cell.inclined
  )
  candidates.sort((a, b) => instancesDistance(unit, a) - instancesDistance(unit, b))
  for (const cell of candidates) {
    if (unit.i === cell.i && unit.j === cell.j) return cell
    if (getInstancePath(unit, cell.i, cell.j, transport.context.map).length) return cell
  }
  return null
}

export function findTransportCoastCell(transport, shoreCell) {
  if (!transport?.context?.map || !shoreCell) return null
  const { grid } = transport.context.map
  const candidates = getCellsAroundPoint(
    shoreCell.i,
    shoreCell.j,
    grid,
    1,
    cell => (cell.category === 'Water' || cell.waterBorder) && !cell.solid && !cell.border
  )
  candidates.sort((a, b) => instancesDistance(transport, a) - instancesDistance(transport, b))
  return candidates[0] || null
}

export function findUnloadCell(transport, unit = null) {
  if (!transport?.context?.map) return null
  const { grid } = transport.context.map
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

export function boardTransport(unit, transport) {
  if (!canUnitEnterTransport(unit, transport)) return false
  const cargo = getTransportCargo(transport)
  cargo.push(unit)
  unit.stopInterval()
  unit.handleChangeDest()
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
  unit.unselect()
  const player = unit.context.player
  if (player?.selectedUnit === unit) player.selectedUnit = null
  if (Array.isArray(player?.selectedUnits)) {
    const selectedIndex = player.selectedUnits.indexOf(unit)
    if (selectedIndex >= 0) player.selectedUnits.splice(selectedIndex, 1)
  }
  if (unit.currentCell?.has === unit) {
    unit.currentCell.has = null
    unit.currentCell.solid = false
  }
  unit.context.map.removeFromInstanceBucket(unit)
  if (unit.parent) unit.parent.removeChild(unit)
  return true
}

export function unloadTransport(transport) {
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
    unit.x = cell.x
    unit.y = cell.y
    unit.z = cell.z
    unit.zIndex = getInstanceZIndex(unit)
    unit.currentCell = cell
    cell.place(unit)
    cell.solid = true
    unit.eventMode = 'static'
    unit.visible = true
    transport.context.map.addChild(unit)
    transport.context.map.addToInstanceBucket(unit)
    unit.setTextures(unit.currentSheet)
    updateInstanceVisibility(unit)
    unloaded++
  }
  return unloaded
}

export function sendUnitToTransport(unit, transport) {
  if (!canUnitEnterTransport(unit, transport)) return false
  const shoreCell = findLoadShoreCell(unit, transport)
  if (!shoreCell) return false
  const coastCell = findTransportCoastCell(transport, shoreCell)
  unit.transportLoadShoreCell = shoreCell
  unit.transportLoadCoastCell = coastCell
  if (coastCell) transport.sendTo(coastCell)
  return unit.sendToWithCell(transport, shoreCell, ACTION_TYPES.loadTransport)
}
