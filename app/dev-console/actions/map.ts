import {
  drawInstanceBlinkingSelection,
  getFreeLandCellAroundInstance,
  getGaiaAnimals,
  teleportRuntimeUnitToCell,
  updateInstanceVisibility,
} from '../../lib'
import type { CommandResult } from '../DevCommandRegistry'
import type { DevCell, DevConsoleContext, DevEntity, DevPlayer } from '../types'
import { getInstancesByCategory, normalize, normalizeToggle } from './shared'

const PORTAL_RESOURCE_TYPE = 'Portal'

function refreshAnimalsAndCameraVisibility(context: DevConsoleContext): void {
  const { map, player, controls } = context

  getGaiaAnimals(map.gaia).forEach(animal => {
    const cell = map.grid[animal.i]?.[animal.j]
    if (!map.revealEverything && !player.views.isViewed(animal.i, animal.j)) {
      animal.visible = false
      return
    }
    cell?.updateVisible()
  })

  controls?.cameraController?.visibleCells?.clear()
  controls?.updateVisibleCells?.()
}

function getHero(context: DevConsoleContext): DevEntity | null {
  return (
    (context.controls as { heroUnit?: DevEntity | null } | undefined)?.heroUnit ||
    context.player.units.find(unit => unit.controlMode === 'hero' || unit.type === 'Hero') ||
    context.player.units.find(unit => unit.isChief) ||
    context.player.units[0] ||
    null
  )
}

function getCurrentWorldPortal(context: DevConsoleContext): DevEntity | null {
  const { map } = context
  const portalFromResources = [...map.resources].find(resource => resource.type === PORTAL_RESOURCE_TYPE)
  if (portalFromResources) return portalFromResources

  for (const row of map.grid) {
    for (const cell of row) {
      const occupant = cell.has as DevEntity | null | undefined
      if (occupant?.type === PORTAL_RESOURCE_TYPE) return occupant
    }
  }
  return null
}

function teleportUnitToCell(context: DevConsoleContext, unit: DevEntity, cell: DevCell): void {
  teleportRuntimeUnitToCell(context.map, unit, cell)
}

function findPortalArrivalCell(context: DevConsoleContext, portal: DevEntity): DevCell | null {
  const { map } = context
  return getFreeLandCellAroundInstance(portal, map.grid, cells => cells[0])
}

export function teleportHeroToPortal(context: DevConsoleContext): CommandResult {
  const { map, menu, controls } = context
  const portal = getCurrentWorldPortal(context)
  if (!portal) return { ok: false, message: 'No portal on current map' }

  const hero = getHero(context)
  if (!hero) return { ok: false, message: 'No hero unit found' }

  const cell = findPortalArrivalCell(context, portal)
  if (!cell) return { ok: false, message: 'No free land cell around portal' }

  controls?.stopKeyboardMove?.()
  teleportUnitToCell(context, hero, cell)
  updateInstanceVisibility(hero)
  map._fogQueue?.clear()
  map.mapFog?.viewportRenderer.invalidate()
  map.mapFog?.viewportRenderer.update(controls?.cameraController?.getViewportRect())
  if (controls?.cameraController?.set) controls.cameraController.set(hero.x, hero.y)
  else controls?.setCamera?.(hero.x, hero.y)
  controls?.cameraController?.visibleCells?.clear()
  controls?.updateVisibleCells?.()
  if (menu.isMiniMapActive?.() !== false) {
    menu.updatePlayerMiniMapEvt?.(context.player)
    menu.updateCameraMiniMapEvt?.()
  }
  return { ok: true, message: `Hero teleported near portal ${portal.i},${portal.j} -> ${cell.i},${cell.j}` }
}

export function toggleFog(context: DevConsoleContext, value: string): CommandResult {
  const { map, menu, players } = context
  const currently = map.fogLayer?.visible ?? !map.revealEverything
  const showFog = normalizeToggle(value, currently)
  map.revealEverything = !showFog
  if (map.fogMemoryLayer) map.fogMemoryLayer.visible = showFog
  if (map.fogLayer) map.fogLayer.visible = showFog
  if (showFog) {
    map.mapFog?.viewportRenderer.invalidate()
    map.mapFog?.viewportRenderer.update(context.controls?.cameraController?.getViewportRect())
  } else {
    map._fogQueue?.clear()
    map._pendingFogChunkUpdates?.clear()
  }

  map.terrainChunkManager?.invalidateAll()

  const minimapActive = menu.isMiniMapActive?.() !== false
  if (!showFog) {
    if (minimapActive) menu.revealTerrainMinimap?.()
    map.resources.forEach(resource => {
      const cell = map.grid[resource.i]?.[resource.j]
      cell?.updateVisible()
    })
  } else if (minimapActive) {
    menu.rebuildTerrainMiniMapFromViews?.()
  }

  refreshAnimalsAndCameraVisibility(context)

  if (minimapActive) {
    menu.updateResourcesMiniMapEvt?.()
    players.forEach((p: DevPlayer) => menu.updatePlayerMiniMapEvt?.(p))
    menu.updateCameraMiniMapEvt?.()
  }

  return { ok: true, message: `Fog of war: ${showFog ? 'on' : 'off'}` }
}

export function toggleResourcesVisibility(context: DevConsoleContext, value: string): CommandResult {
  const { map, menu } = context
  const currently = map.showResources ?? true
  const showResources = normalizeToggle(value, currently)

  map.showResources = showResources
  map.resources.forEach(resource => {
    const cell = map.grid[resource.i]?.[resource.j]
    if (showResources) {
      cell?.updateVisible()
    } else {
      resource.visible = false
    }
  })
  if (menu.isMiniMapActive?.() !== false) menu.updateResourcesMiniMapEvt?.()

  return { ok: true, message: `Resources: ${showResources ? 'on' : 'off'}` }
}

export function highlightInstances(context: DevConsoleContext, category: string, typeName = ''): CommandResult {
  if (!category) return { ok: false, message: 'Usage: highlight <units|buildings|resources|enemies> [type]' }
  const instances = getInstancesByCategory(context, normalize(category), typeName)
  if (!instances) return { ok: false, message: 'Usage: highlight <units|buildings|resources|enemies> [type]' }
  instances.forEach(instance => drawInstanceBlinkingSelection(instance))
  return { ok: true, message: `Highlighted ${instances.length} ${category}${typeName ? ` ${typeName}` : ''}` }
}

export function killResources(context: DevConsoleContext, typeName = 'all'): CommandResult {
  const { map, menu } = context
  const wantedType = normalize(typeName)
  const resources = [...map.resources].filter(
    (resource: DevEntity) => wantedType === 'all' || normalize(resource.type) === wantedType
  )
  resources.forEach(resource => resource.die?.(true))
  if (menu.isMiniMapActive?.() !== false) menu.updateResourcesMiniMapEvt?.()
  return { ok: true, message: `Killed ${resources.length} resources${typeName !== 'all' ? ` ${typeName}` : ''}` }
}
