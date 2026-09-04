const DEFAULT_CIVILIZATION = 'Hellas'

const CIVILIZATION_CANONICAL_BY_KEY: Record<string, string> = {
  hellas: 'Hellas',
  latium: 'Latium',
  kemet: 'Kemet',
  sumeria: 'Sumeria',
  xia: 'Xia',
  alba: 'Alba',
  nord: 'Nord',
  nobatia: 'Nobatia',
}

const CIVILIZATION_ASSET_SLUG_BY_CANONICAL: Record<string, string> = {
  Hellas: 'hellas',
  Latium: 'latium',
  Kemet: 'kemet',
  Sumeria: 'sumeria',
  Xia: 'xia',
  Alba: 'alba',
  Nord: 'nord',
  Nobatia: 'nobatia',
}

function civilizationKey(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase()
}

export function normalizeCivilization(civilization: string | null | undefined): string {
  const key = civilizationKey(civilization)
  if (!key) return DEFAULT_CIVILIZATION
  return CIVILIZATION_CANONICAL_BY_KEY[key] || DEFAULT_CIVILIZATION
}

export function civilizationAssetSlug(civilization: string | null | undefined): string {
  const key = normalizeCivilization(civilization)
  return CIVILIZATION_ASSET_SLUG_BY_CANONICAL[key] || key.toLowerCase()
}
