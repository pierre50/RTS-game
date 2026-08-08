import type { ContainerChild } from 'pixi.js'
import { FAMILY_TYPES, PLAYER_TYPES } from '../../constants'
import type { AnimalEntity, BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import type { SaveEntityState, SaveReference, SavedAIState, SavedEnemyMemoryState } from '../../types/save'
import type { MapGenerationMap } from './MapGeneration'

export type SavedPlayer = {
  type: string
  isPlayed?: boolean
  buildings?: SaveEntityState[]
  units?: SaveEntityState[]
  corpses?: SaveEntityState[]
  aiState?: SavedAIState
  selectedUnitLabels?: string[]
  selectedUnitLabel?: string | null
  selectedBuildingLabel?: string | null
  selectedOtherLabel?: string | null
}

type AIEnemyMemoryRuntime = {
  instance: RuntimeEntity
  label: string
  lastSeenAt: number
  visible?: boolean
}
type AIThreatRuntime = {
  target: RuntimeEntity | null
  attacker: RuntimeEntity | null
  lastSeenAt: number
  attackerFamily?: string
  attackerType?: string
  count?: number
}
type AIPlayerMemoryState = PlayerLike & {
  phase: string
  lastAttackWaveAt: number
  getNow(): number
  enemyUnitMemory: Map<string, AIEnemyMemoryRuntime>
  enemyBuildingMemory: Map<string, AIEnemyMemoryRuntime>
  threatenedTargets: Map<string, AIThreatRuntime>
}
type RestoringMobileEntity = (UnitEntity | AnimalEntity) & {
  action?: string | null
  blockedGatherApproach?: { target: SaveReference | RuntimeEntity; action: string } | null
  buildQueue?: Array<string | BuildingEntity>
  commonSendTo?: UnitEntity['commonSendTo']
  getAction?: (name: string) => void
  path?: RuntimeCell[]
  previousDest?: RuntimeEntity | RuntimeCell | null
  sendTo?: UnitEntity['sendTo']
  setDest?: UnitEntity['setDest']
  setPath?: UnitEntity['setPath']
  stop?: UnitEntity['stop']
  work?: string | null
}
function isRuntimeEntity(value: ContainerChild | null): value is RuntimeEntity & ContainerChild {
  return Boolean(value && typeof (value as Partial<RuntimeEntity>).family === 'string')
}

function isRuntimeDestination(value: RuntimeEntity | RuntimeCell | null): value is RuntimeEntity {
  return Boolean(value && 'family' in value)
}
// --- Saved-game restore helpers -------------------------------------------------
// Shared by generateFromJSON and applySavedStateToGeneratedMap, which rebuild the
// same runtime cross-references (unit destinations, building assignments, AI
// memory) from a serialized save.

// A saved reference is either a [i, j] grid coordinate, a [i, j, label] tuple (an
// entity currently standing on a cell), or a bare label string (entity lookup).
function getDest(val: SaveReference | RuntimeEntity | RuntimeCell | null | undefined, map: MapGenerationMap): RuntimeEntity | RuntimeCell | null {
  if (val) {
    if (Array.isArray(val)) {
      return val[2] ? getRuntimeEntityByLabel(map, val[2]) : map.grid[val[0]][val[1]]
    } else {
      return getRuntimeEntityByLabel(map, val as string)
    }
  }
  return null
}

function getRuntimeEntityByLabel(map: MapGenerationMap, label: string): RuntimeEntity | null {
  const child = map.getChildByLabel(label)
  return isRuntimeEntity(child) ? child : null
}

// Saved references used for unit/building ownership links and AI memory always
// encode an entity label, never a bare grid cell, so this narrows the lookup above.
function getDestEntity(val: SaveReference | RuntimeEntity | RuntimeCell | null | undefined, map: MapGenerationMap): RuntimeEntity | null {
  const dest = getDest(val, map)
  return isRuntimeDestination(dest) ? dest : null
}

export function processUnit(unit: RestoringMobileEntity, context: MapGenerationMap): void {
  const restoringUnit = unit as RestoringMobileEntity
  const savedPath: RuntimeCell[] = Array.isArray(unit.path) ? unit.path : []
  const savedAction = unit.action
  const savedBuildQueue = Array.isArray(restoringUnit.buildQueue) ? restoringUnit.buildQueue : []
  if (unit.previousDest) {
    unit.previousDest = getDest(unit.previousDest, context)
  }
  if (unit.dest && !unit.isDead) {
    const dest = getDest(unit.dest, context)
    if (dest) {
      unit.dest = null
      unit.path = []
      unit.setDest?.(dest)
      unit.action = savedAction
      const restoredPath = savedPath.map((cell: RuntimeCell) => context.grid[cell.i]?.[cell.j]).filter(Boolean)
      if (restoredPath.length) {
        unit.setPath?.(restoredPath)
      } else if (savedAction && unit.getAction) {
        unit.getAction(savedAction)
      } else {
        const destEntity = isRuntimeDestination(dest) ? dest : null
        unit.commonSendTo && destEntity
          ? unit.commonSendTo(destEntity, unit.work ?? '', savedAction ?? null, true, true, true)
          : unit.sendTo?.(dest, savedAction ?? undefined)
      }
    } else {
      unit.stop?.()
    }
  }
  if (savedBuildQueue.length) {
    unit.buildQueue = savedBuildQueue
      .map(item => (typeof item === 'string' ? getDestEntity(item, context) : item))
      .filter((entity): entity is BuildingEntity => Boolean(entity))
  }
  if (restoringUnit.blockedGatherApproach) {
    const saved = restoringUnit.blockedGatherApproach
    const target = getDestEntity(saved.target, context)
    unit.blockedGatherApproach = target ? { target, action: saved.action } : null
  }
}

export function restorePlayerEntitiesFromSave(player: PlayerLike, savedPlayer: SavedPlayer): void {
  const { buildings, units, corpses } = savedPlayer
  player.buildings = (buildings || []).map(building => player.createBuilding({ ...building, skipBuiltEffects: true }))
  player.units = (units || [])
    .map(unit => player.createUnit?.({ ...unit, suppressCreateSound: true }, { preserveType: true }))
    .filter((unit): unit is NonNullable<typeof unit> => Boolean(unit))
  player.corpses = (corpses || [])
    .map(unit => player.createUnit?.({ ...unit, suppressCreateSound: true }, { preserveType: true }))
    .filter((unit): unit is NonNullable<typeof unit> => Boolean(unit))
}

export function restoreBuildingAssignments(
  player: PlayerLike,
  savedBuildings: SaveEntityState[],
  context: MapGenerationMap
): void {
  for (let index = 0; index < player.buildings.length; index++) {
    const building = player.buildings[index]
    const savedBuilding = savedBuildings[index]
    if (!building || !savedBuilding?.isUsedBy) continue
    const user = getDestEntity(savedBuilding.isUsedBy, context)
    if (user && !user.isDead && !user.isDestroyed) {
      building.isUsedBy = user
    }
  }
}

export function restoreSelection(player: PlayerLike, savedPlayer: SavedPlayer, context: MapGenerationMap): void {
  if (!savedPlayer?.isPlayed) return
  const controls = context.context.controls
  const heroUnit = controls && 'heroUnit' in controls ? controls.heroUnit : null
  player.selectedUnits = []
  player.selectedUnit = null
  player.selectedBuilding = null
  player.selectedOther = null
  context.context.menu?.setActionTarget?.(heroUnit ?? null)
}

export function restoreAIState(player: PlayerLike, savedPlayer: SavedPlayer, context: MapGenerationMap): void {
  if (player.type !== PLAYER_TYPES.ai || !savedPlayer?.aiState) return

  const state = savedPlayer.aiState
  // Narrowed to the concrete AI player's bookkeeping fields — see AIPlayerMemoryState.
  const aiPlayer = player as AIPlayerMemoryState
  const now = aiPlayer.getNow()
  const validPhases = new Set(['economy', 'military_build', 'attack'])
  if (state.phase && validPhases.has(state.phase)) {
    aiPlayer.phase = state.phase
  }

  if (Number.isFinite(state.lastAttackWaveAgo)) {
    aiPlayer.lastAttackWaveAt = now - Math.max(0, state.lastAttackWaveAgo ?? 0)
  } else if (Number.isFinite(state.lastAttackWaveAt) && Number.isFinite(state.savedAt)) {
    aiPlayer.lastAttackWaveAt = now - Math.max(0, (state.savedAt ?? 0) - (state.lastAttackWaveAt ?? 0))
  }

  const restoreMemories = (
    savedMemories: SavedEnemyMemoryState[] | undefined,
    memoryMap: Map<string, AIEnemyMemoryRuntime>
  ) => {
    memoryMap.clear()
    for (const savedMemory of savedMemories || []) {
      if (!savedMemory || typeof savedMemory !== 'object') continue
      const instance = getDestEntity(savedMemory.instance, context)
      if (!instance || instance.isDead || instance.isDestroyed || !player.isEnemy?.(instance.owner)) continue

      player.rememberEnemy?.(instance)
      const memory = memoryMap.get(instance.label)
      if (!memory) continue
      memory.lastSeenAt = now - Math.max(0, (savedMemory.lastSeenAgo as number) || 0)
      memory.visible = player.views.isVisible(instance.i, instance.j)
      if (instance.family === FAMILY_TYPES.building) player.foundedEnemyBuildings?.add(instance)
      if (instance.family === FAMILY_TYPES.unit) player.foundedEnemyUnits?.add(instance)
    }
  }
  restoreMemories(state.enemyUnits, aiPlayer.enemyUnitMemory)
  restoreMemories(state.enemyBuildings, aiPlayer.enemyBuildingMemory)

  aiPlayer.threatenedTargets.clear()
  for (const threat of state.threatenedTargets || []) {
    if (!threat || typeof threat !== 'object') continue
    const target = getDestEntity(threat.target, context)
    if (!target || target.isDead || target.isDestroyed) continue

    const attacker = getDestEntity(threat.attacker, context)
    const lastSeenAgo = Number.isFinite(threat.lastSeenAgo)
      ? Math.max(0, threat.lastSeenAgo ?? 0)
      : Number.isFinite(state.savedAt) && Number.isFinite(threat.lastSeenAt)
        ? Math.max(0, (state.savedAt ?? 0) - (threat.lastSeenAt ?? 0))
        : 0
    aiPlayer.threatenedTargets.set(target.label, {
      target,
      attacker: attacker || null,
      attackerFamily: attacker?.family || threat.attackerFamily || undefined,
      attackerType: attacker?.type || threat.attackerType || undefined,
      lastSeenAt: now - lastSeenAgo,
      count: Number.isFinite(threat.count) ? (threat.count ?? 0) : 0,
    })
  }
}

export function restorePlayerViewsAndFog(player: PlayerLike, map: MapGenerationMap): void {
  player.views.restoreViewers(name => getDestEntity(name, map))
  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      if (player.views.isViewed(i, j)) {
        player.views.onViewed?.(i, j)
      }
      if (player.isPlayed && player.views.isViewed(i, j)) {
        if (!player.views.isVisible(i, j)) {
          map.grid[i][j].setFog(true)
        } else {
          map.grid[i][j].removeFog()
        }
      }
    }
  }
}
