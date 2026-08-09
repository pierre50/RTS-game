import type { FactionRelationState, FactionSave, SavePlayerState } from '../types/save'
import type { PlayerLike } from '../types/player'

export const FACTION_SCORE = {
  allied: 75,
  friendly: 35,
  neutral: 0,
  hostile: -65,
} as const

const CIV_TRIBE_NAMES: Record<string, { prefixes: string[]; roots: string[] }> = {
  Greek: {
    prefixes: ['Maison', 'Ligue', 'Clan', 'Cercle'],
    roots: ['Athros', 'Myron', 'Helika', 'Dorien', 'Ephyra', 'Kallias'],
  },
  Egyptian: {
    prefixes: ['Maison', 'Nomades', 'Gardiens', 'Enfants'],
    roots: ['Akhet', 'Menka', 'Sobek', 'Nehesi', 'Aset', 'Kem'],
  },
  Babylonian: {
    prefixes: ['Cite', 'Maison', 'Clan', 'Veilleurs'],
    roots: ['Ur-Nammu', 'Ishtar', 'Nabur', 'Enlil', 'Kish', 'Sippar'],
  },
  Celtic: {
    prefixes: ['Clan', 'Cercle', 'Maison', 'Veilleurs'],
    roots: ['Brennos', 'Epona', 'Nemeton', 'Lugos', 'Arduenna', 'Cernun'],
  },
  Roman: {
    prefixes: ['Maison', 'Cohorte', 'Gens', 'Gardes'],
    roots: ['Valeria', 'Aquila', 'Marcellus', 'Sabina', 'Rufus', 'Livia'],
  },
  Nubian: {
    prefixes: ['Maison', 'Gardes', 'Clan', 'Enfants'],
    roots: ['Kush', 'Amani', 'Napata', 'Meroe', 'Taharka', 'Kandake'],
  },
  Asian: {
    prefixes: ['Maison', 'Clan', 'Jardin', 'Gardes'],
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

export function getFactionRelationState(score: number): FactionRelationState {
  if (score <= -50) return 'hostile'
  if (score < -10) return 'wary'
  if (score < 25) return 'neutral'
  if (score < 65) return 'friendly'
  return 'allied'
}

export function createFactionName(civilization: string | undefined, seed: string): string {
  const names = CIV_TRIBE_NAMES[civilization || ''] ?? CIV_TRIBE_NAMES.Greek
  return `${pickStable(names.prefixes, seed, 'prefix')} ${pickStable(names.roots, seed, 'root')}`
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

export function playerFactionId(player?: Pick<PlayerLike, 'factionId'> | Pick<SavePlayerState, 'factionId'> | null): string | null {
  return player?.factionId ?? null
}

export function arePlayersHostile(
  a: Pick<PlayerLike, 'label' | 'team' | 'factionId' | 'diplomacy'>,
  b: Pick<PlayerLike, 'label' | 'team' | 'factionId' | 'diplomacy'> | null | undefined,
  factions?: Record<string, FactionSave> | null
): boolean {
  if (!b || a.label === b.label) return false

  const aFaction = playerFactionId(a)
  const bFaction = playerFactionId(b)
  if (aFaction && bFaction && aFaction === bFaction) return false

  if (aFaction && factions?.[aFaction]) return factions[aFaction].relationState === 'hostile'
  if (bFaction && factions?.[bFaction]) return factions[bFaction].relationState === 'hostile'

  if (a.diplomacy === 'neutral' || b.diplomacy === 'neutral') return false
  if (a.team !== null && a.team !== undefined && a.team === b.team) return false
  return true
}
