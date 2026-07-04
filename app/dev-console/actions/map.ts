import { drawInstanceBlinkingSelection } from '../../lib'
import type { CommandResult } from '../DevCommandRegistry'
import type { DevConsoleContext, DevEntity, DevPlayer } from '../types'
import { getInstancesByCategory, normalize, normalizeToggle } from './shared'

function refreshAnimalsAndCameraVisibility(context: DevConsoleContext): void {
  const { map, player, controls } = context

  map.gaia?.units.forEach(animal => {
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

  if (!showFog) {
    menu.revealTerrainMinimap?.()
    map.resources.forEach(resource => {
      const cell = map.grid[resource.i]?.[resource.j]
      cell?.updateVisible()
    })
  } else {
    menu.rebuildTerrainMiniMapFromViews?.()
  }

  refreshAnimalsAndCameraVisibility(context)

  menu.updateResourcesMiniMapEvt?.()
  players.forEach((p: DevPlayer) => menu.updatePlayerMiniMapEvt?.(p))
  menu.updateCameraMiniMapEvt?.()

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
  menu.updateResourcesMiniMapEvt?.()

  return { ok: true, message: `Resources: ${showResources ? 'on' : 'off'}` }
}

export function toggleTerrainReveal(context: DevConsoleContext, value: string): CommandResult {
  const { map, menu } = context
  const revealTerrain = normalizeToggle(value, Boolean(map.revealTerrain))
  map.revealTerrain = revealTerrain
  map.mapFog?.viewportRenderer.invalidate()
  map.mapFog?.viewportRenderer.update(context.controls?.cameraController?.getViewportRect())
  if (revealTerrain) {
    menu.revealTerrainMinimap?.()
  } else {
    menu.updateResourcesMiniMapEvt?.()
  }
  return { ok: true, message: `Reveal terrain: ${revealTerrain ? 'on' : 'off'}` }
}

export function highlightInstances(context: DevConsoleContext, category: string, typeName = ''): CommandResult {
  if (!category) return { ok: false, message: 'Usage: highlight <units|buildings|resources|enemies> [type]' }
  const instances = getInstancesByCategory(context, normalize(category), typeName)
  if (!instances) return { ok: false, message: 'Usage: highlight <units|buildings|resources|enemies> [type]' }
  instances.forEach(instance =>
    drawInstanceBlinkingSelection(instance as unknown as Parameters<typeof drawInstanceBlinkingSelection>[0])
  )
  return { ok: true, message: `Highlighted ${instances.length} ${category}${typeName ? ` ${typeName}` : ''}` }
}

export function killResources(context: DevConsoleContext, typeName = 'all'): CommandResult {
  const { map, menu } = context
  const wantedType = normalize(typeName)
  const resources = [...map.resources].filter(
    (resource: DevEntity) => wantedType === 'all' || normalize(resource.type) === wantedType
  )
  resources.forEach(resource => resource.die?.(true))
  menu.updateResourcesMiniMapEvt?.()
  return { ok: true, message: `Killed ${resources.length} resources${typeName !== 'all' ? ` ${typeName}` : ''}` }
}
