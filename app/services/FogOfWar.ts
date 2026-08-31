import { FAMILY_TYPES, PLAYER_TYPES } from '../constants'
import { instanceIsInInsightRange } from '../lib/units/insightDetection'
import { OUTSIDE_SPACE_ID, getMapSpace } from '../lib/mapSpaces'
import type { PerformanceMonitorLike } from '../types/context'
import type { RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell, RuntimeMap, RuntimeMapSpace } from '../types/map'
import type { PlayerLike } from '../types/player'
import type { VisionViewerRef } from '../types/vision'

type ViewerSet = Set<VisionViewerRef>

type VisibilityContext = {
  performance?: PerformanceMonitorLike | null
  map?: {
    grid?: RuntimeCell[][]
    revealEverything?: boolean
  }
  player?: PlayerLike
  editor?: object
  controls?: {
    heroUnit?: UnitEntity | null
    isHeroStealthMode?: () => boolean
  }
}

type VisibilityOwner = Partial<PlayerLike> & {
  views?: PlayerLike['views']
}

export type VisibilityEntity = {
  i: number
  j: number
  label: string
  visible?: boolean
  context?: VisibilityContext
  owner?: VisibilityOwner | null
  spaceId?: string | null
  sight?: number
  providesVision?: boolean
  isDead?: boolean
  visibleCells?: Set<number>
  visibleSpaceId?: string | null
  _visibleScratch?: Set<number>
}

type DetectingEntity = RuntimeEntity & {
  detect: (instance: VisibilityEntity) => void
}

function canDetect(entity: RuntimeEntity): entity is DetectingEntity {
  return typeof (entity as { detect?: DetectingEntity['detect'] }).detect === 'function'
}

function syncVisibleSet(target: ViewerSet, source: ReadonlySet<VisionViewerRef>): void {
  if (target === source) return
  if (target.size === source.size) {
    let identical = true
    for (const item of source) {
      if (!target.has(item)) {
        identical = false
        break
      }
    }
    if (identical) return
  }

  target.clear()
  for (const item of source) {
    target.add(item)
  }
}

function updateAIKnowledge(globalCell: RuntimeCell, viewer: PlayerLike, { staticOnly = false } = {}): void {
  const owner = viewer
  const known = viewer.views.getKnownOccupant(globalCell.i, globalCell.j)

  if (globalCell.has && (!known || known.label !== globalCell.has.label)) {
    viewer.views.setKnownOccupant(globalCell.i, globalCell.j, globalCell.has)
    const { has } = globalCell

    if ((has.quantity ?? 0) > 0) {
      owner.foundedResources?.[has.type]?.add(has)
    }

    if (!staticOnly && has.family === FAMILY_TYPES.animal && !has.isDead && owner.foundedAnimals) {
      owner.foundedAnimals.add(has)
    }

    if (!staticOnly && has.family === FAMILY_TYPES.building && (has.hitPoints ?? 0) > 0 && owner.isEnemy?.(has.owner)) {
      owner.foundedEnemyBuildings?.add(has)
      owner.rememberEnemy?.(has)
    }

    if (!staticOnly && has.family === FAMILY_TYPES.unit && (has.hitPoints ?? 0) > 0 && owner.isEnemy?.(has.owner)) {
      owner.foundedEnemyUnits?.add(has)
      owner.rememberEnemy?.(has)
    }
  }
}

export function rehydrateAIKnowledge(viewer: PlayerLike, map: RuntimeMap): void {
  if (viewer.type !== PLAYER_TYPES.ai) return

  for (let i = 0; i < map.grid.length; i++) {
    const row = map.grid[i]
    if (!row) continue

    for (let j = 0; j < row.length; j++) {
      const globalCell = row[j]
      if (!globalCell || !viewer.views.isViewed(i, j)) continue

      updateAIKnowledge(globalCell, viewer, { staticOnly: !viewer.views.isVisible(i, j) })

      if (viewer.views.isVisible(i, j)) {
        for (const corpse of globalCell.corpses || []) {
          if (
            corpse.family === FAMILY_TYPES.animal &&
            corpse.isDead &&
            !corpse.isDestroyed &&
            (corpse.quantity ?? 0) > 0
          ) {
            viewer.foundedDeadAnimals?.add(corpse)
          }
        }
      }
    }
  }
}

export function updateVisibility(instance: VisibilityEntity): void {
  const performanceMonitor = instance.context?.performance
  if (performanceMonitor)
    return performanceMonitor.measureSampled('visibility.update', () => updateVisibilityNow(instance))
  return updateVisibilityNow(instance)
}

function updateVisibilityNow(instance: VisibilityEntity): void {
  const { i: cx, j: cy, sight = 0, owner, context, isDead } = instance
  const map = context?.map
  const player = context?.player
  if (!owner?.views || !player?.views || !map?.grid) return
  const ownerPlayer = owner as PlayerLike
  const runtimeMap = map as RuntimeMap
  const currentSpace = getMapSpace(runtimeMap, instance.spaceId) ?? getMapSpace(runtimeMap, OUTSIDE_SPACE_ID)
  if (!currentSpace) return
  const previousSpace = getMapSpace(runtimeMap, instance.visibleSpaceId) ?? currentSpace
  const spaceChanged = previousSpace.id !== currentSpace.id
  const sightSq = sight * sight

  const prevVisible = instance.visibleCells ?? new Set()
  const newVisible = instance._visibleScratch ?? new Set()
  newVisible.clear()

  if (!isDead && instance.providesVision !== false) {
    const minI = Math.max(cx - sight, 0)
    const maxI = Math.min(cx + sight, currentSpace.size ?? owner.views.size)
    const minJ = Math.max(cy - sight, 0)
    const maxJ = Math.min(cy + sight, currentSpace.size ?? owner.views.size)
    for (let i = minI; i <= maxI; i++) {
      for (let j = minJ; j <= maxJ; j++) {
        const dx = i - cx
        const dy = j - cy
        if (dx * dx + dy * dy <= sightSq) {
          newVisible.add(owner.views.index(i, j))
        }
      }
    }
  }

  for (const index of prevVisible) {
    if (spaceChanged || !newVisible.has(index)) {
      const [i, j] = owner.views.coordinates(index)
      const globalCell = previousSpace.grid[i]?.[j]
      if (!globalCell) continue
      withPlayerViewSpace(ownerPlayer, previousSpace, () => ownerPlayer.views.removeViewer(i, j, instance))
      withPlayerViewSpace(player, previousSpace, () => syncVisibleSet(globalCell.viewBy, player.views.getViewers(i, j)))

      if (!withPlayerViewSpace(player, previousSpace, () => player.views.isVisible(i, j)) && !map.revealEverything) {
        globalCell.setFog()
      }
    }
  }

  for (const index of newVisible) {
    if (spaceChanged || !prevVisible.has(index)) {
      const [i, j] = owner.views.coordinates(index)
      const globalCell = currentSpace.grid[i]?.[j]
      if (!globalCell) continue

      withPlayerViewSpace(ownerPlayer, currentSpace, () => ownerPlayer.views.addViewer(i, j, instance))
      if (withPlayerViewSpace(ownerPlayer, currentSpace, () => ownerPlayer.views.setViewed(i, j))) {
        ownerPlayer.cellViewed++
      }
      if (ownerPlayer.type === PLAYER_TYPES.ai) {
        withPlayerViewSpace(ownerPlayer, currentSpace, () => updateAIKnowledge(globalCell, ownerPlayer))
      }
      withPlayerViewSpace(player, currentSpace, () => syncVisibleSet(globalCell.viewBy, player.views.getViewers(i, j)))
      globalCell.updateVisible()

      if (!map.revealEverything && withPlayerViewSpace(player, currentSpace, () => player.views.hasViewer(i, j, instance))) {
        globalCell.removeFog()
      }

      if (!context?.editor && globalCell.has && globalCell.has.sight && canDetect(globalCell.has)) {
        if (instanceIsInInsightRange(globalCell.has, instance)) {
          globalCell.has.detect(instance)
        }
      }
    }
  }

  instance.visibleCells = newVisible
  instance.visibleSpaceId = currentSpace.id
  instance._visibleScratch = prevVisible
}

function withPlayerViewSpace<T>(player: PlayerLike, space: RuntimeMapSpace, callback: () => T): T {
  return player.views.withSpace?.(space.id, callback) ?? callback()
}
