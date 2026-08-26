export const MAX_MAP_EDGE = 513

export type ObjectRecord = Record<string, unknown>

export function fail(message: string): never {
  throw new Error(message)
}

export function isObject(value: unknown): value is ObjectRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function validateGridPosition(value: unknown, size: number, label: string): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value >= size) {
    fail(`Invalid save file: ${label} is out of bounds.`)
  }
}

export function validateArray(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    fail(`Invalid save file: ${label} must be an array.`)
  }
}

export function validateCell(cell: unknown, i: number, j: number): void {
  if (!isObject(cell)) fail(`Invalid save file: cell ${i},${j} is invalid.`)
  if (cell.z != null && !isFiniteNumber(cell.z)) fail(`Invalid save file: cell ${i},${j} has an invalid height.`)
  if (typeof cell.type !== 'string' || !cell.type) fail(`Invalid save file: cell ${i},${j} has an invalid type.`)
  validateArray(cell.fogSprites ?? [], `cell ${i},${j} fogSprites`)
}

export function validateViewCell(cell: unknown, i: number, j: number): void {
  if (!isObject(cell)) fail(`Invalid save file: view cell ${i},${j} is invalid.`)
  if (cell.viewed != null && typeof cell.viewed !== 'boolean') {
    fail(`Invalid save file: view cell ${i},${j} has an invalid viewed flag.`)
  }
  validateArray(cell.viewBy ?? [], `view cell ${i},${j} viewBy`)
}

export function validateEntityPosition(entity: unknown, size: number, label: string): asserts entity is ObjectRecord {
  if (!isObject(entity)) fail(`Invalid save file: ${label} is invalid.`)
  validateGridPosition(entity.i, size, `${label}.i`)
  validateGridPosition(entity.j, size, `${label}.j`)
}

export function validateOptionalFiniteNumber(value: unknown, label: string): void {
  if (value != null && !isFiniteNumber(value)) {
    fail(`Invalid save file: ${label} must be a finite number.`)
  }
}

export function validateOptionalBoolean(value: unknown, label: string): void {
  if (value != null && typeof value !== 'boolean') {
    fail(`Invalid save file: ${label} must be a boolean.`)
  }
}

export function validateOptionalGridDestination(value: unknown, size: number, label: string): void {
  if (value == null) return

  if (Array.isArray(value)) {
    if (value.length < 2 || value.length > 3) {
      fail(`Invalid save file: ${label} is invalid.`)
    }
    validateGridPosition(value[0], size, `${label}.i`)
    validateGridPosition(value[1], size, `${label}.j`)
    if (value[2] != null && typeof value[2] !== 'string') {
      fail(`Invalid save file: ${label}.label is invalid.`)
    }
    return
  }

  if (!isObject(value)) {
    fail(`Invalid save file: ${label} is invalid.`)
  }
  validateGridPosition(value.i, size, `${label}.i`)
  validateGridPosition(value.j, size, `${label}.j`)
  validateOptionalFiniteNumber(value.x, `${label}.x`)
  validateOptionalFiniteNumber(value.y, `${label}.y`)
  if (value.label != null && typeof value.label !== 'string') {
    fail(`Invalid save file: ${label}.label is invalid.`)
  }
}

export function validateAnimalPath(path: unknown, size: number, label: string): void {
  if (path == null) return
  validateArray(path, label)
  if (path.length > size * size) {
    fail(`Invalid save file: ${label} is too long.`)
  }
  path.forEach((cell, index) => {
    validateEntityPosition(cell, size, `${label} ${index}`)
  })
}
