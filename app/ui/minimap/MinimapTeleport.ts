import { getActiveMapSpace, getEntitySpaceId } from '../../lib/mapSpaces'
import { isometricToCartesian } from '../../lib/maths'
import { updateInstanceVisibility } from '../../lib/grid/visibility'
import { teleportRuntimeUnitToCell } from '../../lib/units/unitPlacement'
import type { MinimapHostLike } from '../../types/context'
import type { RuntimeCell } from '../../types/map'
import { startTeleportDiagnostics, traceRuntime } from '../../lib/runtimeDiagnostics'

export function teleportHeroFromMinimap(menu: MinimapHostLike, point: { x: number; y: number }): void {
  const { controls, map } = menu.context
  const hero = controls.heroUnit
  const space = getActiveMapSpace(map)
  if (!hero || hero.isDead || hero.isDestroyed || !space || getEntitySpaceId(hero) !== space.id) return
  const [i, j] = isometricToCartesian(point.x - (space.origin?.x ?? 0), point.y - (space.origin?.y ?? 0))
  if (!Number.isFinite(i) || !Number.isFinite(j) || i < 0 || j < 0 || i > space.size || j > space.size) return
  startTeleportDiagnostics({ fromI: hero.i, fromJ: hero.j, toI: i, toJ: j, space: space.id })
  traceRuntime('teleport', () => {
    // Find nearby land when the click falls on a building, tree or water edge.
    let destination: RuntimeCell | undefined
    for (let radius = 0; radius <= 12 && !destination; radius++) {
      let bestDistance = Infinity
      for (let di = -radius; di <= radius; di++) {
        for (let dj = -radius; dj <= radius; dj++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== radius) continue
          const cell = space.grid[i + di]?.[j + dj]
          if (
            !cell ||
            cell.solid ||
            cell.has ||
            cell.category === 'Water' ||
            cell.waterBorder ||
            cell.border ||
            cell.terrainHidden
          )
            continue
          const distance = di * di + dj * dj
          if (distance < bestDistance) {
            destination = cell
            bestDistance = distance
          }
        }
      }
    }
    if (!destination) return
    menu.context.performance?.markEvent?.('teleport.minimap', {
      fromI: hero.i,
      fromJ: hero.j,
      toI: destination.i,
      toJ: destination.j,
      space: space.id,
    })
    const target = destination
    traceRuntime('teleport.stopHero', () => hero.stop?.())
    traceRuntime('teleport.placeHero', () => teleportRuntimeUnitToCell(map, hero, target))
    traceRuntime('teleport.visibility', () => updateInstanceVisibility(hero))
    traceRuntime('teleport.camera', () =>
      controls.setCamera?.(hero.x + (space.origin?.x ?? 0), hero.y + (space.origin?.y ?? 0))
    )
    traceRuntime('teleport.visibleCells', () => controls.updateVisibleCells?.())
    traceRuntime('teleport.minimap', () => menu.minimapManager.refreshMiniMap?.())
    menu.context.menu?.closeInventory?.()
  })
}
