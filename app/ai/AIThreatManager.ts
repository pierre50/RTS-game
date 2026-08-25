import { findInstancesInSight } from '../lib'
import { ACTION_TYPES, BUILDING_TYPES, FAMILY_TYPES, UNIT_TYPES } from '../constants'
import { getDefensePowerNeed, getThreatProfile } from './AIThreatProfiles'
import { handleThreatResponses } from './AIThreatResponses'
import type { AIEntityLike, EnemyMemoryOptions } from './types'
import type { ActiveThreat, EnemyMemory, StoredThreat, ThreatManagerPlayer, ThreatProfile } from './AIThreatTypes'
import type { RenderableInstance } from '../lib/grid/visibility'
import type { RuntimeEntity } from '../types/entities'

export type { ActiveThreat, EnemyMemory, StoredThreat, ThreatManagerPlayer, ThreatProfile } from './AIThreatTypes'

export class AIThreatManager {
  readonly player: ThreatManagerPlayer

  constructor(player: ThreatManagerPlayer) {
    this.player = player
  }

  rememberEnemy(enemy: AIEntityLike): void {
    if (!enemy?.label || !this.player.isEnemy(enemy.owner)) return
    const memoryMap =
      enemy.family === FAMILY_TYPES.building ? this.player.enemyBuildingMemory : this.player.enemyUnitMemory
    const visible = this.player.views.isVisible(enemy.i, enemy.j)
    memoryMap.set(enemy.label, {
      instance: enemy,
      label: enemy.label,
      ownerLabel: enemy.owner?.label,
      family: enemy.family,
      type: enemy.type,
      i: enemy.i,
      j: enemy.j,
      hitPoints: enemy.hitPoints,
      totalHitPoints: enemy.totalHitPoints,
      lastSeenAt: this.player.getNow(),
      visible,
    })
  }

  refreshEnemyMemory(memoryMap: Map<string, EnemyMemory>): void {
    const now = this.player.getNow()
    for (const [label, memory] of memoryMap) {
      const enemy = memory.instance
      if (
        !enemy ||
        enemy.isDead ||
        enemy.isDestroyed ||
        (enemy.hitPoints ?? 0) <= 0 ||
        !this.player.isEnemy(enemy.owner)
      ) {
        memoryMap.delete(label)
        continue
      }
      const visible = this.player.views.isVisible(enemy.i, enemy.j)
      if (visible) {
        memory.i = enemy.i
        memory.j = enemy.j
        memory.hitPoints = enemy.hitPoints
        memory.totalHitPoints = enemy.totalHitPoints
        memory.lastSeenAt = now
      } else if (now - memory.lastSeenAt > 90000) {
        memoryMap.delete(label)
        continue
      }
      memory.visible = visible
    }
  }

  getEnemyMemories({ family = null, freshWithin = Infinity, visibleOnly = false }: EnemyMemoryOptions = {}) {
    const now = this.player.getNow()
    const sources = []
    if (!family || family === FAMILY_TYPES.unit) sources.push(...this.player.enemyUnitMemory.values())
    if (!family || family === FAMILY_TYPES.building) sources.push(...this.player.enemyBuildingMemory.values())
    return sources.filter(memory => {
      if (!memory?.instance) return false
      if (visibleOnly && !memory.visible) return false
      return now - memory.lastSeenAt <= freshWithin
    })
  }

  getFreshEnemyInstances(options = {}) {
    return this.getEnemyMemories(options).map(memory => memory.instance)
  }

  reportThreat(target: RuntimeEntity, attacker: RuntimeEntity): void {
    if (!target || target.owner?.label !== this.player.label || !attacker || attacker.isDead || attacker.isDestroyed) {
      return
    }

    const now = this.player.getNow()
    const key = target.label
    const existing = this.player.threatenedTargets.get(key)

    this.player.threatenedTargets.set(key, {
      target,
      lastSeenAt: now,
      attacker,
      attackerFamily: attacker.family,
      attackerType: attacker.type,
      count: (existing?.count || 0) + 1,
    })

    if (attacker.owner && this.player.isEnemy(attacker.owner)) {
      this.rememberEnemy(attacker)
    }
  }

  cleanupThreats(): void {
    const now = this.player.getNow()
    for (const [key, threat] of this.player.threatenedTargets) {
      const target = threat.target
      if (!target || target.isDead || target.isDestroyed || target.owner?.label !== this.player.label) {
        this.player.threatenedTargets.delete(key)
        continue
      }

      const hostiles = this.getVisibleHostilesNear(target)
      if (hostiles.length > 0) {
        threat.lastSeenAt = now
        threat.attacker = hostiles[0]
        threat.attackerFamily = hostiles[0].family
        threat.attackerType = (hostiles[0].type as string) ?? ''
        continue
      }

      if (now - threat.lastSeenAt > 8000) {
        this.player.threatenedTargets.delete(key)
      }
    }
  }

  getVisibleHostilesNear(target: AIEntityLike, radius = 10): AIEntityLike[] {
    const sightOrigin: RenderableInstance = {
      i: target.i,
      j: target.j,
      x: target.x ?? target.i,
      y: target.y ?? target.j,
      label: target.label,
      sight: radius,
      context: this.player.context,
    }
    return findInstancesInSight(
      sightOrigin,
      instance => {
        const candidate = instance as AIEntityLike
        if (
          !candidate ||
          candidate === target ||
          candidate.isDead ||
          candidate.isDestroyed ||
          (candidate.hitPoints ?? 0) <= 0
        ) {
          return false
        }
        if (candidate.family === FAMILY_TYPES.animal) {
          return Boolean(
            candidate.strategy === 'attack' ||
              candidate.action === ACTION_TYPES.attack ||
              (candidate.dest && 'owner' in candidate.dest && candidate.dest.owner?.label === this.player.label)
          )
        }
        return this.player.isEnemy(candidate.owner)
      },
      { useInsightRange: true }
    ) as AIEntityLike[]
  }

  isBuildingThreatened(building: AIEntityLike): boolean {
    const threat = this.player.threatenedTargets.get(building?.label)
    if (!threat) return false
    if (!building || building.isDead || building.isDestroyed) return false
    return this.player.getNow() - threat.lastSeenAt <= 8000
  }

  getActiveThreats(): ActiveThreat[] {
    this.cleanupThreats()
    return [...this.player.threatenedTargets.values()]
      .filter((threat: StoredThreat) => threat?.target && !threat.target.isDead && !threat.target.isDestroyed)
      .map((threat: StoredThreat): ActiveThreat => {
        const hostiles = this.getVisibleHostilesNear(threat.target)
        const profile = this.getThreatProfile({ ...threat, hostiles })
        return { ...threat, hostiles, profile }
      })
      .filter((threat: ActiveThreat) => threat.target && threat.hostiles.length > 0)
      .sort((a: ActiveThreat, b: ActiveThreat) => b.profile.priority - a.profile.priority)
  }

  getHomeAnchor(): AIEntityLike | null {
    const townCenters = this.player
      .buildingsByTypes([BUILDING_TYPES.townCenter])
      .filter(building => !building.isDead && !building.isDestroyed)
    if (townCenters.length > 0) return townCenters[0]

    const fallbackBuilding = this.player.buildings.find(building => !building.isDead && !building.isDestroyed)
    if (fallbackBuilding) return fallbackBuilding

    const fallbackVillager = this.player.units.find(unit => unit.type === UNIT_TYPES.villager && !unit.isDead)
    return fallbackVillager || null
  }

  getThreatProfile(threat: StoredThreat & { hostiles: AIEntityLike[] }): ThreatProfile {
    return getThreatProfile(this.player, threat, this.getHomeAnchor())
  }

  getDefensePowerNeed(profile: ThreatProfile): number {
    return getDefensePowerNeed(this.player, profile)
  }

  handleThreatResponses({
    villagers,
    waitingMilitary,
    debug = false,
  }: {
    villagers: AIEntityLike[]
    waitingMilitary: AIEntityLike[]
    debug?: boolean
  }): number {
    return handleThreatResponses(this, { villagers, waitingMilitary, debug })
  }
}
