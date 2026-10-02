import type { PreparedSettlements, PreparedSettlementReference } from '../types/preparedSettlements'
import { MapBlueprintLoadError } from './blueprint/MapBlueprintErrors'

async function sha256Text(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Declared preparations are authoritative: an unavailable/stale file must never trigger live generation. */
export async function loadPreparedSettlements(
  worldId: string,
  reference: PreparedSettlementReference,
  rawMap: string,
  mapId: string | number,
  size: number
): Promise<PreparedSettlements> {
  const invalid = (reason: string): never => {
    throw new MapBlueprintLoadError('map-invalid', `Prepared settlements: ${reason}`)
  }
  if (!/^[a-zA-Z0-9_.-]+\.settlements\.json$/.test(reference.path)) invalid('invalid path')
  if ((await sha256Text(rawMap)) !== reference.sourceSha256) invalid('source map changed; run world:prepare')
  const response = await fetch(`maps/worlds/${worldId}/maps/${reference.path}`, { cache: 'no-store' })
  if (!response.ok) invalid(`file unavailable (${response.status})`)
  const raw = await response.text()
  if ((await sha256Text(raw)) !== reference.sha256) invalid('file checksum mismatch; run world:prepare')
  const data = JSON.parse(raw) as PreparedSettlements
  if (
    data.format !== 'prepared-settlements' ||
    data.version !== 1 ||
    data.mapId !== mapId ||
    data.size !== size ||
    data.source?.sha256 !== reference.sourceSha256 ||
    data.source?.rulesSha256 !== reference.rulesSha256 ||
    !Array.isArray(data.players) ||
    !Array.isArray(data.resources) ||
    !Array.isArray(data.animals) ||
    !Array.isArray(data.banditCamps) ||
    !Array.isArray(data.heroSpawns) ||
    !Array.isArray(data.settlements)
  )
    invalid('incompatible preparation; run world:prepare')
  return data
}
