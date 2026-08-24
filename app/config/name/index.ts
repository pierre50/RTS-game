import asian from './asian'
import babylonian from './babylonian'
import celtic from './celtic'
import egyptian from './egyptian'
import greek from './greek'
import nordic from './nordic'
import nubian from './nubian'
import roman from './roman'

type UnitNameGender = 'male' | 'female'
type UnitNamesByGender = Record<UnitNameGender, string[]>

const NAMES_BY_CIV: Record<string, UnitNamesByGender> = {
  Asian: asian,
  Babylonian: babylonian,
  Celtic: celtic,
  Egyptian: egyptian,
  Greek: greek,
  Nordic: nordic,
  Nubian: nubian,
  Roman: roman,
}

function normalizeGender(gender: string | null | undefined): UnitNameGender {
  return gender === 'female' ? 'female' : 'male'
}

export function getRandomUnitName(
  civ: string | null | undefined,
  gender?: string | null,
  random = Math.random
): string | undefined {
  const namesByGender = NAMES_BY_CIV[civ || ''] ?? NAMES_BY_CIV.Greek
  const names = namesByGender[normalizeGender(gender)]
  if (!names.length) return undefined

  return names[Math.floor(random() * names.length)]
}
