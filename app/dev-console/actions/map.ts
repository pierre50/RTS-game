import { getGaiaAnimals } from '../../lib'
import type { CommandResult } from '../DevCommandRegistry'
import type { DevConsoleContext, DevEntity, DevPlayer } from '../types'
import { getDevMapSpace, normalize, normalizeToggle } from './shared'

function refreshAnimalsAndCameraVisibility(context: DevConsoleContext): void {
  const { map, controls } = context

  getGaiaAnimals(map.gaia).forEach(animal => {
    const cell = map.grid[animal.i]?.[animal.j]
    cell?.updateVisible()
  })

  controls?.cameraController?.visibleCells?.clear()
  controls?.updateVisibleCells?.()
}

export function toggleFog(context: DevConsoleContext, value: string): CommandResult {
  const { map, menu, players } = context
  const currently = !map.revealEverything
  const showFog = normalizeToggle(value, currently)
  map.revealEverything = !showFog
  // This debug toggle now controls minimap knowledge only; the main view follows the camera.

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

  return { ok: true, message: `Minimap exploration: ${showFog ? 'on' : 'off'}` }
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

export function toggleInteriorWalls(context: DevConsoleContext, value = ''): CommandResult {
  if (value && value !== 'on' && value !== 'off') {
    return { ok: false, message: 'Usage: walls [on|off]' }
  }
  const space = getDevMapSpace(context, context.map.activeSpaceId ?? context.controls?.heroUnit?.spaceId)
  if (space?.kind !== 'interior') {
    return { ok: false, message: 'Enter a cave or building interior first.' }
  }
  const children = 'children' in space.container ? space.container.children : []
  const walls = children.filter(child => child.label === 'interior-wall')
  if (!walls.length) return { ok: false, message: 'No walls in this interior.' }
  const visible = normalizeToggle(
    value,
    walls.some(wall => wall.visible)
  )
  for (const wall of walls) wall.visible = visible
  return { ok: true, message: `Interior walls: ${visible ? 'on' : 'off'} (${walls.length})` }
}
