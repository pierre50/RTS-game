import { MAX_MAP_EDGE, fail, isFiniteNumber, isObject, validateArray } from './SaveValidationPrimitives'

export function validateMinimapBuildingMemory(value: unknown): void {
  if (value === undefined) return // Older saves have no building observations.
  validateArray(value, 'minimap building memory')
  const identities = new Set<string>()
  for (const entry of value) {
    if (!isObject(entry)) fail('Invalid save file: minimap building memory is invalid.')
    for (const field of ['id', 'spaceId', 'ownerKey', 'color']) {
      if (typeof entry[field] !== 'string' || !entry[field])
        fail(`Invalid save file: minimap building memory ${field} is invalid.`)
    }
    for (const field of ['x', 'y', 'i', 'j', 'size']) {
      if (!isFiniteNumber(entry[field])) fail(`Invalid save file: minimap building memory ${field} is invalid.`)
    }
    for (const field of ['i', 'j', 'size']) {
      if (
        !Number.isInteger(entry[field]) ||
        Number(entry[field]) < (field === 'size' ? 1 : 0) ||
        Number(entry[field]) > MAX_MAP_EDGE
      )
        fail(`Invalid save file: minimap building memory ${field} is invalid.`)
    }
    if (typeof entry.town !== 'boolean') fail('Invalid save file: minimap building memory town is invalid.')
    if (entry.settlementId !== undefined && (typeof entry.settlementId !== 'string' || !entry.settlementId))
      fail('Invalid save file: minimap settlement identity is invalid.')
    if (entry.settlementKind !== undefined && !['village', 'city', 'outpost'].includes(String(entry.settlementKind)))
      fail('Invalid save file: minimap settlement kind is invalid.')
    const key = JSON.stringify([entry.spaceId, entry.id])
    if (identities.has(key)) fail('Invalid save file: duplicate minimap building memory.')
    identities.add(key)
  }
}

export function validateMinimapPreferences(value: unknown): void {
  if (value === undefined) return
  if (!isObject(value) || ![1, 1.5, 2, 3, 4].includes(Number(value.zoom)) || typeof value.zoom !== 'number')
    fail('Invalid save file: minimap zoom is invalid.')
  validateArray(value.hiddenMarkers, 'minimap filters')
  if (value.hiddenMarkers.some(key => typeof key !== 'string' || !key))
    fail('Invalid save file: minimap filters are invalid.')
}
