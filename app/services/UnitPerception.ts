import { getPackedCellStore } from '../classes/cell/PackedCellRegistry'
import { FAMILY_TYPES, PLAYER_TYPES } from '../constants'
import { heroCanCommand } from '../lib/chief'
import { OUTSIDE_SPACE_ID, getMapSpace } from '../lib/mapSpaces'
import { isAIControlledPlayer } from '../lib/playerState'
import { instanceIsInInsightRange } from '../lib/units/insightDetection'
import { observeTarget } from '../lib/units/playerTargetKnowledge'
import { ownerSharesVision } from '../lib/units/playerVisionAccess'
import type { PerformanceMonitorLike } from '../types/context'
import type { RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell, RuntimeMap, RuntimeMapSpace } from '../types/map'
import type { PlayerLike } from '../types/player'
import { updateAIKnowledge } from './visibility/AIVisibilityKnowledge'

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
  family?: string
  tamingStatus?: string
  companionOwner?: unknown
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

export function rehydrateAIKnowledge(viewer: PlayerLike, map: RuntimeMap): void {
  if (!isAIControlledPlayer(viewer)) return

  const packed = getPackedCellStore(map.grid)
  const rows = packed ? [packed.changedCells(map.grid)] : map.grid
  for (const row of rows) {
    for (const globalCell of row ?? []) {
      if (!globalCell || !viewer.views.isViewed(globalCell.i, globalCell.j)) continue
      const visible = viewer.views.isVisible(globalCell.i, globalCell.j)
      updateAIKnowledge(globalCell, viewer, { staticOnly: !visible })
      if (visible) {
        for (const corpse of globalCell.corpses || []) {
          if (
            corpse.family === FAMILY_TYPES.animal &&
            corpse.isDead &&
            !corpse.isDestroyed &&
            (corpse.quantity ?? 0) > 0
          )
            viewer.foundedDeadAnimals?.add(corpse)
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

  if (
    instance.family &&
    instance.family === FAMILY_TYPES.animal &&
    owner.type === PLAYER_TYPES.gaia &&
    !instance.companionOwner &&
    (!instance.tamingStatus || instance.tamingStatus === 'wild')
  ) {
    // A horse can return to the wild after owning normal visibility.
    for (const index of instance.visibleCells ?? []) {
      const [i, j] = owner.views.coordinates(index)
      withPlayerViewSpace(ownerPlayer, previousSpace, () => ownerPlayer.views.removeViewer(i, j, instance))
    }
    instance.visibleCells?.clear()
    instance._visibleScratch?.clear()
    updateWildAnimalPerception(instance, currentSpace)
    return
  }
  wildAnimalFootprints.delete(instance)

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
    }
  }

  for (const index of newVisible) {
    if (spaceChanged || !prevVisible.has(index)) {
      const [i, j] = owner.views.coordinates(index)
      const globalCell = currentSpace.grid[i]?.[j]
      if (!globalCell) continue

      withPlayerViewSpace(ownerPlayer, currentSpace, () => ownerPlayer.views.addViewer(i, j, instance))
      // Human exploration comes from the hero camera; AI knowledge keeps its own sight radius.
      if (owner !== player && withPlayerViewSpace(ownerPlayer, currentSpace, () => ownerPlayer.views.setViewed(i, j))) {
        ownerPlayer.cellViewed++
      }
      if (isAIControlledPlayer(ownerPlayer)) {
        withPlayerViewSpace(ownerPlayer, currentSpace, () => updateAIKnowledge(globalCell, ownerPlayer))
      }
      if (globalCell.has) observeTarget(ownerPlayer, globalCell.has)
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

// Gaia has no exploration/economy decisions. Keep only the previous footprint,
// not one viewer Set per cell for every wild animal. Reverse detection still
// notifies entities on cells newly reached by the animal's sight, as before.
const wildAnimalFootprints = new WeakMap<VisibilityEntity, { i: number; j: number; sight: number; spaceId: string }>()

function updateWildAnimalPerception(instance: VisibilityEntity, space: RuntimeMapSpace): void {
  const previous = wildAnimalFootprints.get(instance)
  const sight = instance.sight ?? 0
  const providesSight = !instance.isDead && instance.providesVision !== false
  if (providesSight) {
    const minI = Math.max(0, instance.i - sight)
    const maxI = Math.min(space.size, instance.i + sight)
    const minJ = Math.max(0, instance.j - sight)
    const maxJ = Math.min(space.size, instance.j + sight)
    for (let i = minI; i <= maxI; i++) {
      for (let j = minJ; j <= maxJ; j++) {
        if ((i - instance.i) ** 2 + (j - instance.j) ** 2 > sight * sight) continue
        if (previous?.spaceId === space.id && (i - previous.i) ** 2 + (j - previous.j) ** 2 <= previous.sight ** 2)
          continue
        const target = space.grid[i]?.[j]?.has
        if (
          !instance.context?.editor &&
          target?.sight &&
          canDetect(target) &&
          instanceIsInInsightRange(target, instance)
        ) {
          target.detect(instance)
        }
      }
    }
    wildAnimalFootprints.set(instance, { i: instance.i, j: instance.j, sight, spaceId: space.id })
  } else wildAnimalFootprints.delete(instance)
  // Discovery belongs to observers, independent of camera/render visibility.
  const entity = instance as unknown as RuntimeEntity
  for (const observer of entity.context?.players ?? []) observeTarget(observer, entity)
  instance.visibleSpaceId = space.id
}

function withPlayerViewSpace<T>(player: PlayerLike, space: RuntimeMapSpace, callback: () => T): T {
  return player.views.withSpace?.(space.id, callback) ?? callback()
}
