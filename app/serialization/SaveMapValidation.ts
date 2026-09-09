import { gridToLocal } from '../lib/localMapLayout'
import type { GameConfig } from '../types/save'
import {
  fail,
  isObject,
  MAX_MAP_EDGE,
  type ObjectRecord,
  validateArray,
  validateCell,
} from './SaveValidationPrimitives'

type LocalLayout = NonNullable<GameConfig['localGridLayout']>

export function containsCell(layout: LocalLayout, i: number, j: number): boolean {
  const { row, column } = gridToLocal(i, j, layout)
  return row >= 0 && row < layout.rows && column >= 0 && column < layout.columns - (row % 2)
}

export function validateLocalLayout(value: unknown): LocalLayout | undefined {
  if (value === undefined) return undefined
  if (
    !isObject(value) ||
    !Number.isInteger(value.columns) ||
    !Number.isInteger(value.rows) ||
    typeof value.columns !== 'number' ||
    typeof value.rows !== 'number' ||
    value.columns < 2 ||
    value.columns > MAX_MAP_EDGE ||
    value.rows !== 4 * (value.columns - 1) + 1
  ) {
    fail('Invalid save file: local grid layout is invalid.')
  }
  return { columns: value.columns, rows: value.rows }
}

export function validateMap(map: unknown, layout?: LocalLayout): number {
  validateArray(map, 'map')
  if (!map.length || map.length > MAX_MAP_EDGE) {
    fail('Invalid save file: map size is unsupported.')
  }
  const size = map.length
  for (let i = 0; i < size; i++) {
    const row = map[i]
    validateArray(row, `map row ${i}`)
    if (layout ? row.length > size : row.length !== size) {
      fail('Invalid save file: map must be square.')
    }
    for (let j = 0; j < size; j++) {
      if (layout && !containsCell(layout, i, j)) {
        if (row[j] != null) fail(`Invalid save file: cell ${i},${j} is outside the local grid layout.`)
        continue
      }
      validateCell(row[j], i, j)
    }
  }
  return size
}

export function validateSeedWorld(data: ObjectRecord, legacyMapSize: number | null = null): number {
  const world = isObject(data.world) ? data.world : {}
  const config = isObject(data.config) ? data.config : {}
  const rawSize = world.size ?? config.size ?? (legacyMapSize != null ? legacyMapSize - 1 : null)
  if (typeof rawSize !== 'number' || !Number.isInteger(rawSize) || rawSize < 1 || rawSize >= MAX_MAP_EDGE) {
    fail('Invalid save file: map size is unsupported.')
  }
  const seed = world.seed ?? config.seed
  if (
    world.sourceSize != null &&
    (typeof world.sourceSize !== 'number' ||
      !Number.isInteger(world.sourceSize) ||
      world.sourceSize < 1 ||
      world.sourceSize >= MAX_MAP_EDGE)
  ) {
    fail('Invalid save file: source map size is unsupported.')
  }
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    fail('Invalid save file: map seed is invalid.')
  }
  const mapType = world.mapType ?? config.mapType
  if (mapType != null && (typeof mapType !== 'string' || !mapType)) {
    fail('Invalid save file: map type is invalid.')
  }
  const environment = world.environment ?? config.environment
  if (environment != null && (typeof environment !== 'string' || !environment)) {
    fail('Invalid save file: map environment is invalid.')
  }
  return rawSize + 1
}
