import type { Condition, ConfigValue } from '../../types/config'

const arraysEqual = (a: readonly ConfigValue[], b: readonly ConfigValue[]): boolean => {
  if (a.length !== b.length) return false
  const sortedA = a.slice().sort()
  const sortedB = b.slice().sort()
  return sortedA.every((val, index) => val === sortedB[index])
}

export const isValidCondition = (condition: Condition | null | undefined, values: object): boolean => {
  if (!condition) return true

  const { op, key, value } = condition
  const expectedValue = (values as Record<string, ConfigValue>)[key]

  if (expectedValue === undefined) {
    if (isOptionalDiscoveryKey(key)) return false
    throw new Error(`Key not found in values: ${key}`)
  }

  switch (op) {
    case '=':
    case '!=': {
      const result = conditionValuesEqual(value, expectedValue)
      return op === '!=' ? !result : result
    }
    case '<':
      return Number(expectedValue) < Number(value)
    case '<=':
      return Number(expectedValue) <= Number(value)
    case '>=':
      return Number(expectedValue) >= Number(value)
    case '>':
      return Number(expectedValue) > Number(value)
    case 'includes':
      return Array.isArray(expectedValue) && expectedValue.includes(value)
    case 'notincludes':
      return Array.isArray(expectedValue) && !expectedValue.includes(value)
    default:
      throw new Error(`Invalid condition operation provided: ${op}`)
  }
}

function conditionValuesEqual(value: ConfigValue, expectedValue: ConfigValue): boolean {
  return Array.isArray(value) && Array.isArray(expectedValue)
    ? arraysEqual(value, expectedValue)
    : value === expectedValue
}

function isOptionalDiscoveryKey(key: string): boolean {
  return key === 'discoveredEquipment' || key === 'completedObjectives'
}
