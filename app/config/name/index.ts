import asian from './asian'
import babylonian from './babylonian'
import celtic from './celtic'
import egyptian from './egyptian'
import greek from './greek'
import nubian from './nubian'
import roman from './roman'

const NAMES_BY_CIV: Record<string, string[]> = {
  Asian: asian,
  Babylonian: babylonian,
  Celtic: celtic,
  Egyptian: egyptian,
  Greek: greek,
  Nubian: nubian,
  Roman: roman,
}

export function getRandomUnitName(civ: string | null | undefined, random = Math.random): string | undefined {
  const names = NAMES_BY_CIV[civ || ''] ?? NAMES_BY_CIV.Greek
  if (!names.length) return undefined

  return names[Math.floor(random() * names.length)]
}
