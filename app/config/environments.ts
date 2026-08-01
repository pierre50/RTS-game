import { DEFAULT_ENVIRONMENT_ID, type EnvironmentId } from '../constants'

// Which environment a civilization's homeland maps generate as. Kept as a plain
// constant (rather than data on Civilization) since it's a game-setup concern,
// not a civ-balance one.
export const CIV_ENVIRONMENTS: Record<string, EnvironmentId> = {
  Greek: 'Temperate',
  Roman: 'Temperate',
  Egyptian: 'Desert',
  Babylonian: 'Desert',
  Nubian: 'Desert',
  Asian: 'Jungle',
  Celtic: 'BlackForest',
}

export function getEnvironmentForCiv(civ?: string | null): EnvironmentId {
  return (civ && CIV_ENVIRONMENTS[civ]) || DEFAULT_ENVIRONMENT_ID
}
