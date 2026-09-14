import { FAMILY_TYPES } from '../constants'
import { heroCanCommand } from '../lib/chief'
import { OUTSIDE_SPACE_ID,getMapSpace } from '../lib/mapSpaces'
import { isAIControlledPlayer } from '../lib/playerState'
import { instanceIsInInsightRange } from '../lib/units/insightDetection'
import { observeTarget } from '../lib/units/playerTargetKnowledge'
import { ownerSharesVision } from '../lib/units/playerVisionAccess'
import type { PerformanceMonitorLike } from '../types/context'
import type { RuntimeEntity,UnitEntity } from '../types/entities'
import type { RuntimeCell,RuntimeMap,RuntimeMapSpace } from '../types/map'
import type { PlayerLike } from '../types/player'
import type { VisionViewerRef } from '../types/vision'
import { updateAIKnowledge } from './visibility/AIVisibilityKnowledge'

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
  type?: string
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

export function rehydrateAIKnowledge(viewer: PlayerLike, map: RuntimeMap): void {
  if (!isAIControlledPlayer(viewer)) return

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

/** Refresh stationary viewers too when the hero gains or loses command. */
export function refreshPlayerVisibility(context: VisibilityContext): void {
  for (const entity of [...(context.player?.units ?? []), ...(context.player?.buildings ?? [])]) {
    updateVisibility(entity)
  }
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

  const hero = context?.controls?.heroUnit ?? player.units?.find(unit => unit.type === 'Hero')
  const sharesPlayerVision =
    owner !== player ||
    instance === hero ||
    (!hero && instance.type === 'Hero' && owner.isPlayed) ||
    (hero ? heroCanCommand(hero) : ownerSharesVision(owner, context))
  if (!isDead && instance.providesVision !== false && sharesPlayerVision) {
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
      if (isAIControlledPlayer(ownerPlayer)) {
        withPlayerViewSpace(ownerPlayer, currentSpace, () => updateAIKnowledge(globalCell, ownerPlayer))
      }
      withPlayerViewSpace(player, currentSpace, () => syncVisibleSet(globalCell.viewBy, player.views.getViewers(i, j)))
      if (globalCell.has) observeTarget(ownerPlayer, globalCell.has)
      globalCell.updateVisible()

      if (
        !map.revealEverything &&
        withPlayerViewSpace(player, currentSpace, () => player.views.hasViewer(i, j, instance))
      ) {
        globalCell.removeFog()
      }

      if (!context?.editor && globalCell.has && globalCell.has.sight && canDetect(globalCell.has)) {
        if (instanceIsInInsightRange(globalCell.has, instance)) {
          globalCell.has.detect(instance)
        }
      }
    }
  }

  const entity = instance as unknown as RuntimeEntity
  for (const observer of entity.context?.players ?? []) observeTarget(observer, entity)
  instance.visibleCells = newVisible
  instance.visibleSpaceId = currentSpace.id
  instance._visibleScratch = prevVisible
}

function withPlayerViewSpace<T>(player: PlayerLike, space: RuntimeMapSpace, callback: () => T): T {
  return player.views.withSpace?.(space.id, callback) ?? callback()
}
