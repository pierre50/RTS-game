import { FAMILY_TYPES } from '../../constants'
import { definedProperties } from '../../lib/definedProperties'
import { isAIControlledPlayer } from '../../lib/playerState'
import type { RuntimeEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import type { SavedEnemyMemoryState } from '../../types/save'
import type { MapGenerationMap } from './MapGenerationTypes'
import { getDestEntity } from './MapSaveReferences'
import type { SavedPlayer } from './MapSaveRestoreTypes'

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
  getNow(): number
  enemyUnitMemory: Map<string, AIEnemyMemoryRuntime>
  enemyBuildingMemory: Map<string, AIEnemyMemoryRuntime>
  threatenedTargets: Map<string, AIThreatRuntime>
}

export function restoreAIState(player: PlayerLike, savedPlayer: SavedPlayer, context: MapGenerationMap): void {
  if (!isAIControlledPlayer(player) || !savedPlayer?.aiState) return

  const state = savedPlayer.aiState
  // Narrowed to the concrete AI player's bookkeeping fields — see AIPlayerMemoryState.
  const aiPlayer = player as AIPlayerMemoryState
  const now = aiPlayer.getNow()
  const validPhases = new Set(['economy', 'military_build', 'attack'])
  if (state.phase && validPhases.has(state.phase)) {
    aiPlayer.phase = state.phase === 'attack' ? 'military_build' : state.phase
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
    const restored = restoreThreat(threat, state.savedAt, context, now)
    if (restored?.target) aiPlayer.threatenedTargets.set(restored.target.label, restored)
  }
}

type SavedThreat = NonNullable<NonNullable<SavedPlayer['aiState']>['threatenedTargets']>[number]

function threatAge(threat: SavedThreat, savedAt: number | undefined): number {
  if (Number.isFinite(threat.lastSeenAgo)) return Math.max(0, threat.lastSeenAgo ?? 0)
  if (Number.isFinite(savedAt) && Number.isFinite(threat.lastSeenAt)) {
    return Math.max(0, (savedAt ?? 0) - (threat.lastSeenAt ?? 0))
  }
  return 0
}

function restoreThreat(
  threat: SavedThreat,
  savedAt: number | undefined,
  context: MapGenerationMap,
  now: number
): AIThreatRuntime | null {
  if (!threat || typeof threat !== 'object') return null
  const target = getDestEntity(threat.target, context)
  if (!target || target.isDead || target.isDestroyed) return null
  const attacker = getDestEntity(threat.attacker, context)
  return definedProperties({
    target,
    attacker: attacker || null,
    attackerFamily: attacker?.family || threat.attackerFamily || undefined,
    attackerType: attacker?.type || threat.attackerType || undefined,
    lastSeenAt: now - threatAge(threat, savedAt),
    count: Number.isFinite(threat.count) ? (threat.count ?? 0) : 0,
  })
}
