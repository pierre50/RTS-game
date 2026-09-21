const AGES = { stone: 0, bronze: 1, iron: 2 } as const
export const AGE_LABEL_KEYS = ['stoneAge', 'bronzeAge', 'ironAge'] as const
export const AGE_RULES_VERSION = 1

export function migrateSavedAge(age = 0, version?: number): number {
  const previous = Math.max(0, Math.min(Math.floor(age), 3))
  return version === AGE_RULES_VERSION ? Math.min(previous, AGES.iron) : Math.min(previous, 1) + Number(previous === 3)
}
