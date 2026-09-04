import { DEFAULT_ENVIRONMENT_ID, type EnvironmentId } from '../constants'

// Which environment a civilization's homeland maps generate as. Kept as a plain
// constant (rather than data on Civilization) since it's a game-setup concern,
// not a civ-balance one.
const CIV_ENVIRONMENTS: Record<string, EnvironmentId> = {
  Hellas: 'Temperate',
  Latium: 'Temperate',
  Kemet: 'Desert',
  Sumeria: 'Desert',
  Nobatia: 'Desert',
  Xia: 'Jungle',
  Alba: 'BlackForest',
  Nord: 'BlackForest',
}

export function getEnvironmentForCiv(civ?: string | null): EnvironmentId {
  return (civ && CIV_ENVIRONMENTS[civ]) || DEFAULT_ENVIRONMENT_ID
}
