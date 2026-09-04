import xia from './xia'
import sumeria from './sumeria'
import alba from './alba'
import kemet from './kemet'
import hellas from './hellas'
import nord from './nord'
import nobatia from './nobatia'
import latium from './latium'

type UnitNameGender = 'male' | 'female'
type UnitNamesByGender = Record<UnitNameGender, string[]>

const NAMES_BY_CIV: Record<string, UnitNamesByGender> = {
  Xia: xia,
  Sumeria: sumeria,
  Alba: alba,
  Kemet: kemet,
  Hellas: hellas,
  Nord: nord,
  Nobatia: nobatia,
  Latium: latium,
}

function normalizeGender(gender: string | null | undefined): UnitNameGender {
  return gender === 'female' ? 'female' : 'male'
}

export function getRandomUnitName(
  civ: string | null | undefined,
  gender?: string | null,
  random = Math.random
): string | undefined {
  const namesByGender = NAMES_BY_CIV[civ || ''] ?? NAMES_BY_CIV.Hellas
  const names = namesByGender[normalizeGender(gender)]
  if (!names.length) return undefined

  return names[Math.floor(random() * names.length)]
}
