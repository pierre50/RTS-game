import { FAMILY_TYPES } from '../constants'
import { heroCanCommand } from '../lib/chief'
import type { UnitEntity } from '../types/entities'

export type EntityHudSource = {
  label?: string
  context?: { controls?: { heroUnit?: UnitEntity | null } }
  energy?: number
  family: string
  hitPoints: number
  isDead: boolean
  isDestroyed: boolean
  owner?: { isPlayed?: boolean; label?: string; team?: number | null } | null
  selected: boolean
  totalEnergy?: number
  totalHitPoints: number
  shouldKeepEnergyBarVisible(): boolean
  shouldKeepHealthBarVisible(): boolean
}

export type HudBarState = { visible: boolean; ratio: number; removeImmediately?: boolean }

export function isHeroTeamUnit(host: Pick<EntityHudSource, 'family' | 'owner' | 'context'>): boolean {
  const owner = host.owner
  const heroOwner = host.context?.controls?.heroUnit?.owner
  if (host.family !== FAMILY_TYPES.unit || !owner || !heroOwner) return false
  return Boolean(
    owner === heroOwner ||
      (owner.label && owner.label === heroOwner.label) ||
      (owner.team != null && owner.team === heroOwner.team)
  )
}

/** Team unit health is information reserved for the player's chief. */
export function isTeamHealthBarRestricted(host: Pick<EntityHudSource, 'family' | 'owner' | 'context'>): boolean {
  const hero = host.context?.controls?.heroUnit
  return Boolean(isHeroTeamUnit(host) && !heroCanCommand(hero))
}

export function isControlledHero(host: Pick<EntityHudSource, 'label' | 'context'>): boolean {
  return Boolean(host.label && host.context?.controls?.heroUnit?.label === host.label)
}

export function healthBarState(host: EntityHudSource): HudBarState {
  if (isControlledHero(host) || isTeamHealthBarRestricted(host)) {
    return { visible: false, ratio: 0, removeImmediately: true }
  }
  if (
    !host.totalHitPoints ||
    (host.family !== FAMILY_TYPES.unit && host.family !== FAMILY_TYPES.animal) ||
    (!host.shouldKeepHealthBarVisible() && !host.selected)
  ) {
    return { visible: false, ratio: 0 }
  }
  const current = host.family === FAMILY_TYPES.animal && host.isDead ? 0 : host.hitPoints
  return { visible: true, ratio: Math.max(0, Math.min(1, current / host.totalHitPoints)) }
}

export function energyBarState(host: EntityHudSource): HudBarState {
  const total = host.totalEnergy ?? 0
  if (!total || !host.shouldKeepEnergyBarVisible()) return { visible: false, ratio: 0 }
  return { visible: true, ratio: Math.max(0, Math.min(1, (host.energy ?? total) / total)) }
}

export function heroPowerBarState(host: EntityHudSource, ratio: number): HudBarState {
  if (host.isDead || host.isDestroyed || !host.owner?.isPlayed) return { visible: false, ratio: 0 }
  return { visible: true, ratio: Math.max(0, Math.min(1, ratio)) }
}
