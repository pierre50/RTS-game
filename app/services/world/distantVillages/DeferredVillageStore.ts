import { savedBuildingsWithInteriors } from '../../../serialization/InteriorBuildingSave'
import { getBuildingFootprintCells } from '../../../lib/grid/cells'
import type { RuntimeCell } from '../../../types/map'
import { isStaticSettlement } from '../../../config/settlementProfiles'
import { VILLAGE_DETAIL_ENTER_RADIUS } from '../../../config/villageActivity'
import { setDistantOwner } from '../../../lib/units/villageActivity'
import { ambientActivityArea } from '../AmbientActivityArea'
import type { GameContextLike } from '../../../types/context'
import type { PlayerLike } from '../../../types/player'
import type { SavePlayerState } from '../../../types/save'

type Entry = {
  owner: PlayerLike
  state: SavePlayerState
  since: number
  restore: (state: SavePlayerState) => void
  advance: (state: SavePlayerState, from: number, to: number) => void
  waking: boolean
  reserved: { cell: RuntimeCell; solid: boolean }[]
}
const stores = new WeakMap<object, DeferredVillageStore>()
const owners = new WeakMap<object, { store: DeferredVillageStore; entry: Entry }>()

/** Lightweight map markers, without advancing or materializing the settlement. */
export function deferredVillageBuildings(owner: object) {
  return owners.get(owner)?.entry.state.buildings?.map(building => ({
    label: building.label,
    type: building.type,
    i: building.i,
    j: building.j,
    size: building.size,
    spaceId: building.spaceId,
    isDead: building.isDead,
    isDestroyed: building.isDestroyed,
  }))
}

export function deferredVillageState(owner: object): SavePlayerState | undefined {
  const saved = owners.get(owner)
  if (!saved) return undefined
  saved.store.advance(saved.entry)
  return structuredClone(saved.entry.state)
}
export function getDeferredVillages(map: object): DeferredVillageStore | undefined {
  return stores.get(map)
}
export function clearDeferredVillages(map: object): void {
  stores.get(map)?.clear()
  stores.delete(map)
}
export function installDeferredVillages(context: GameContextLike, elapsedMs?: number): DeferredVillageStore {
  clearDeferredVillages(context.map)
  const store = new DeferredVillageStore(context, elapsedMs)
  stores.set(context.map, store)
  return store
}

/** Authoritative saved entities; no Unit/Building, sprite, interior or timer until needed. */
export class DeferredVillageStore {
  private entries = new Map<PlayerLike, Entry>()
  private labels = new Map<string, Entry>()
  private reservations = new Map<RuntimeCell, Entry>()
  constructor(
    private context: GameContextLike,
    private initialElapsedMs?: number
  ) {}
  get size(): number {
    return this.entries.size
  }
  has(owner: PlayerLike): boolean {
    return this.entries.has(owner)
  }
  private now(): number {
    return this.context.dayNight?.getElapsedMs?.() ?? this.initialElapsedMs ?? this.context.scheduler.elapsedMs
  }

  add(owner: PlayerLike, state: SavePlayerState, restore: Entry['restore'], advance: Entry['advance']): void {
    const entry: Entry = {
      owner,
      state: structuredClone(state),
      restore,
      advance,
      since: this.initialElapsedMs ?? this.now(),
      waking: false,
      reserved: [],
    }
    this.entries.set(owner, entry)
    owners.set(owner, { store: this, entry })
    this.index(entry)
    this.reserve(entry)
    setDistantOwner(owner, () => this.wake(owner))
  }

  private index(entry: Entry): void {
    for (const [label, candidate] of this.labels) if (candidate === entry) this.labels.delete(label)
    for (const entity of [
      ...(entry.state.units ?? []),
      ...savedBuildingsWithInteriors(entry.state.buildings ?? []),
      ...(entry.state.corpses ?? []),
    ])
      if (entity.label) this.labels.set(entity.label, entry)
  }

  reservedByOther(owner: PlayerLike, cell: RuntimeCell): boolean {
    const entry = this.reservations.get(cell)
    return Boolean(entry && entry.owner !== owner)
  }
  private release(entry: Entry): void {
    for (const { cell, solid } of entry.reserved) {
      if (this.reservations.get(cell) !== entry) continue
      this.reservations.delete(cell)
      if (!cell.has) cell.solid = solid
    }
    entry.reserved = []
  }
  private reserve(entry: Entry): void {
    for (const building of entry.state.buildings ?? []) {
      if (
        building.isDestroyed ||
        building.isDead ||
        building.type === 'Farm' ||
        (building.spaceId && building.spaceId !== 'outside')
      )
        continue
      const size = building.size ?? (Number(entry.owner.config?.buildings?.[building.type]?.size) || 1)
      getBuildingFootprintCells(
        building.i,
        building.j,
        this.context.map.grid,
        size,
        cell => {
          if (!cell.has && !this.reservations.has(cell)) {
            this.reservations.set(cell, entry)
            entry.reserved.push({ cell, solid: cell.solid })
            cell.solid = true
          }
          return true
        },
        building.type
      )
    }
  }

  advance(entry: Entry): void {
    const now = this.now()
    if (now <= entry.since || entry.waking) return
    entry.advance(entry.state, entry.since, now)
    this.release(entry)
    this.reserve(entry)
    this.index(entry)
    entry.since = now
    // Keep faction summaries correct without exposing saved entities as runtime objects.
    for (const key of ['population', 'populationMax', 'rpgRestockDay'] as const)
      if (entry.state[key] != null) entry.owner[key] = entry.state[key]!
  }

  wakeLabel(label: string): boolean {
    const entry = this.labels.get(label)
    if (!entry || entry.waking) return false
    this.wake(entry.owner)
    return true
  }

  wake(owner: PlayerLike): void {
    const entry = this.entries.get(owner)
    if (!entry || entry.waking) return
    this.advance(entry)
    entry.waking = true
    try {
      this.release(entry)
      entry.restore(entry.state)
      this.entries.delete(owner)
      owners.delete(owner)
      for (const [label, candidate] of this.labels) if (candidate === entry) this.labels.delete(label)
      setDistantOwner(owner)
      this.context.performance?.markEvent?.('village.materialized', {
        owner: owner.label,
        units: owner.units.length,
        buildings: owner.buildings.length,
      })
    } finally {
      entry.waking = false
    }
  }

  update(): void {
    if (!this.entries.size) return
    const visible = ambientActivityArea(this.context)
    const observers = this.context.players.flatMap(player =>
      player.units.filter(
        unit =>
          !unit.isDead &&
          !unit.isDestroyed &&
          (player.isPlayed || unit.followingHero || unit.action === 'attack' || unit.combatMode)
      )
    )
    const hero = this.context.controls?.heroUnit
    if (hero && !hero.isDead && !hero.isDestroyed && !observers.includes(hero)) observers.push(hero)
    const outside = observers.flatMap<{ i: number; j: number }>(unit => {
      if (!unit.spaceId || unit.spaceId === 'outside') return [unit]
      const exit = this.context.map.spaces
        ?.get(unit.spaceId)
        ?.portals?.find(p => p.targetSpaceId === 'outside')?.targetCell
      return exit ? [exit] : []
    })
    let economic: Entry | undefined
    for (const entry of this.entries.values()) {
      const points = [...(entry.state.buildings ?? []), ...(entry.state.units ?? [])].filter(
        point => !point.isDestroyed && (!point.spaceId || point.spaceId === 'outside')
      )
      if (
        points.some(
          point =>
            visible(point) ||
            outside.some(actor => Math.hypot(point.i - actor.i, point.j - actor.j) <= VILLAGE_DETAIL_ENTER_RADIUS)
        )
      ) {
        this.wake(entry.owner)
        break // At most one full settlement per frame, well before the hero reaches it.
      }
      if (
        !isStaticSettlement(entry.state) &&
        this.now() - entry.since >= 2000 &&
        (!economic || entry.since < economic.since)
      )
        economic = entry
    }
    if (economic && this.entries.has(economic.owner)) this.advance(economic)
  }

  clear(): void {
    for (const entry of this.entries.values()) {
      this.release(entry)
      owners.delete(entry.owner)
      setDistantOwner(entry.owner)
    }
    this.entries.clear()
    this.labels.clear()
    this.reservations.clear()
  }
}

export function canDeferVillage(context: GameContextLike, state: SavePlayerState): boolean {
  return (
    !context.editor &&
    state.type === 'AI' &&
    !state.isPlayed &&
    Boolean(state.buildings?.length) &&
    !context
      .getQuestJournal?.()
      ?.quests.some(
        quest =>
          quest.status === 'active' &&
          (quest.owner.playerLabel === state.label || state.units?.some(unit => unit.label === quest.owner.entityLabel))
      ) &&
    !(state.units ?? []).some(
      unit =>
        unit.followingHero ||
        unit.controlMode === 'hero' ||
        unit.factionExpedition ||
        unit.cavePosition ||
        unit.caveOrders ||
        unit.action === 'attack' ||
        unit.action === 'flee'
    )
  )
}
