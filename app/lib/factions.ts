import type { FactionRelationState, FactionSave } from '../types/save'
import { t } from './lang'

export const FACTION_SCORE = {
  allied: 75,
  friendly: 35,
  neutral: 0,
  hostile: -65,
} as const

const CIV_TRIBE_NAMES: Record<string, { prefixes: string[]; roots: string[] }> = {
  Greek: {
    prefixes: ['factionPrefixHouse', 'factionPrefixLeague', 'factionPrefixClan', 'factionPrefixCircle'],
    roots: ['Athros', 'Myron', 'Helika', 'Dorien', 'Ephyra', 'Kallias'],
  },
  Egyptian: {
    prefixes: ['factionPrefixHouse', 'factionPrefixNomads', 'factionPrefixGuardians', 'factionPrefixChildren'],
    roots: ['Akhet', 'Menka', 'Sobek', 'Nehesi', 'Aset', 'Kem'],
  },
  Babylonian: {
    prefixes: ['factionPrefixCity', 'factionPrefixHouse', 'factionPrefixClan', 'factionPrefixWatchers'],
    roots: ['Ur-Nammu', 'Ishtar', 'Nabur', 'Enlil', 'Kish', 'Sippar'],
  },
  Celtic: {
    prefixes: ['factionPrefixClan', 'factionPrefixCircle', 'factionPrefixHouse', 'factionPrefixWatchers'],
    roots: ['Brennos', 'Epona', 'Nemeton', 'Lugos', 'Arduenna', 'Cernun'],
  },
  Roman: {
    prefixes: ['factionPrefixHouse', 'factionPrefixCohort', 'factionPrefixPeople', 'factionPrefixGuards'],
    roots: ['Valeria', 'Aquila', 'Marcellus', 'Sabina', 'Rufus', 'Livia'],
  },
  Nubian: {
    prefixes: ['factionPrefixHouse', 'factionPrefixGuards', 'factionPrefixClan', 'factionPrefixChildren'],
    roots: ['Kush', 'Amani', 'Napata', 'Meroe', 'Taharka', 'Kandake'],
  },
  Asian: {
    prefixes: ['factionPrefixHouse', 'factionPrefixClan', 'factionPrefixGarden', 'factionPrefixGuards'],
    roots: ['Shen', 'Yun', 'Qiao', 'Han', 'Lin', 'Ming'],
  },
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pickStable<T>(items: T[], seed: string, salt: string): T {
  return items[hashString(`${seed}:${salt}`) % items.length]
}

function getFactionRelationState(score: number): FactionRelationState {
  if (score <= -50) return 'hostile'
  if (score < -10) return 'wary'
  if (score < 25) return 'neutral'
  if (score < 65) return 'friendly'
  return 'allied'
}

function createFactionName(civilization: string | undefined, seed: string): string {
  const names = CIV_TRIBE_NAMES[civilization || ''] ?? CIV_TRIBE_NAMES.Greek
  return `${t(pickStable(names.prefixes, seed, 'prefix'))} ${pickStable(names.roots, seed, 'root')}`
}

export function createFactionSave(options: {
  civilization?: string
  homeWorldId: string
  id: string
  initialScore: number
  name?: string
  now: number
}): FactionSave {
  const score = Math.max(-100, Math.min(100, Math.round(options.initialScore)))
  return {
    id: options.id,
    civilization: options.civilization,
    homeWorldId: options.homeWorldId,
    knownWorldIds: [options.homeWorldId],
    name: options.name || createFactionName(options.civilization, options.id),
    relationScore: score,
    relationState: getFactionRelationState(score),
    discoveredAt: options.now,
    updatedAt: options.now,
  }
}

export function adjustFactionRelation(faction: FactionSave, delta: number, now: number): FactionSave {
  const relationScore = Math.max(-100, Math.min(100, Math.round(faction.relationScore + delta)))
  return {
    ...faction,
    relationScore,
    relationState: getFactionRelationState(relationScore),
    updatedAt: now,
  }
}
