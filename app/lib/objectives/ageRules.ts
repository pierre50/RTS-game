const AGES = { stone: 0, bronze: 1, iron: 2 } as const
export const AGE_LABEL_KEYS = ['stoneAge', 'bronzeAge', 'ironAge'] as const
export const AGE_RULES_VERSION = 1

type AgeOwner = { age?: number } | null | undefined

function hasReachedAge(owner: AgeOwner, age: number): boolean {
  return (owner?.age ?? AGES.stone) >= age
}

function getEquipmentRequiredAge(item: string): number {
  if (/(^|_)iron(_|$)/.test(item)) return AGES.iron
  if (
    item === 'catchingPole' ||
    /(^|_)(copper|bronze)(_|$)/.test(item) ||
    item === 'bow_great' ||
    item === 'bow_recurve'
  )
    return AGES.bronze
  return AGES.stone
}

export function canUseAgeEquipment(owner: AgeOwner, item: string): boolean {
  return hasReachedAge(owner, getEquipmentRequiredAge(item))
}

export function getResourceRequiredAge(resource: string): number {
  if (resource.toLowerCase() === 'copper') return AGES.bronze
  if (resource.toLowerCase() === 'iron') return AGES.iron
  return AGES.stone
}

export function canGatherAgeResource(owner: AgeOwner, resource: string): boolean {
  return hasReachedAge(owner, getResourceRequiredAge(resource))
}

export function migrateSavedAge(age = 0, version?: number): number {
  const previous = Math.max(0, Math.min(Math.floor(age), 3))
  return version === AGE_RULES_VERSION ? Math.min(previous, AGES.iron) : Math.min(previous, 1) + Number(previous === 3)
}
