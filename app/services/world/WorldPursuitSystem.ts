import { AI, Player } from '../../classes/players'
import { PLAYER_TYPES } from '../../constants'
import { updateInstanceVisibility } from '../../lib'
import { findOpenWorldTravelCell } from './WorldRegionTravelSystem'
import type { GameContextLike } from '../../types/context'
import type { AnimalEntity, UnitEntity } from '../../types/entities'
import type { PendingWorldPursuer, SavePlayerState } from '../../types/save'

export class WorldPursuitSystem {
  private pending: PendingWorldPursuer[] = []
  private readonly task: number

  constructor(private readonly context: GameContextLike) {
    this.task = context.scheduler.add(() => this.update(), 100, 'world.pursuers')
  }

  restore(entries: PendingWorldPursuer[] = []): void {
    this.pending = structuredClone(entries)
  }

  enqueue(entries: PendingWorldPursuer[]): void {
    this.pending.push(...structuredClone(entries))
  }

  serializeState(): PendingWorldPursuer[] {
    return structuredClone(this.pending)
  }

  private ownerFor(saved: SavePlayerState): GameContextLike['player'] {
    if (saved.isPlayed) return this.context.player
    const existing = this.context.players.find(
      player => player.label === saved.label || (saved.factionId && player.factionId === saved.factionId)
    )
    if (existing) return existing
    const PlayerClass = saved.type === PLAYER_TYPES.ai || saved.type === PLAYER_TYPES.bandits ? AI : Player
    const owner = new PlayerClass({ ...saved, units: [], buildings: [], corpses: [] }, this.context)
    this.context.players.push(owner)
    return owner
  }

  private update(): void {
    this.pending = this.pending.filter(entry => {
      entry.remainingMs = Math.max(0, entry.remainingMs - 100)
      if (entry.remainingMs > 0) return true
      const { map, players } = this.context
      const cell = findOpenWorldTravelCell(map, entry.arrival, 4, 1)
      if (!cell) return true
      const state = {
        ...entry.entity,
        i: cell.i,
        j: cell.j,
        x: cell.x,
        y: cell.y,
        z: cell.z,
        spaceId: 'outside',
        path: [],
        dest: null,
        previousDest: null,
        realDest: null,
        action: null,
        buildQueue: [],
        blockedGatherApproach: null,
        campPatrolAnchor: null,
        banditCampAnchor: null,
        suppressCreateSound: true,
      }
      const owner = entry.owner ? this.ownerFor(entry.owner) : null
      const entity = owner ? owner.createUnit?.(state, { preserveType: true }) : map.gaia?.createAnimal?.(state)
      if (!entity) return true
      if (owner) owner.population = (owner.population ?? 0) + 1
      const target = players
        .flatMap(player => player.units)
        .find(unit => unit.label === entry.targetLabel && !unit.isDead && !unit.isDestroyed)
      if (target) (entity as UnitEntity | AnimalEntity).sendTo?.(target, entry.entity.action ?? undefined)
      updateInstanceVisibility(entity)
      this.context.menu?.refreshMiniMap?.()
      return false
    })
  }

  destroy(): void {
    this.context.scheduler.remove(this.task)
    this.pending = []
  }
}
