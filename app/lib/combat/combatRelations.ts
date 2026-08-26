import type { CombatEntity } from '../../types/combat'

export function isFriendlyTarget(source?: CombatEntity | null, target?: CombatEntity | null): boolean {
  if (!source?.owner || !target?.owner) return false
  if (source.owner.label === target.owner.label) return true
  return source.owner.isEnemy?.(target.owner as never) === false
}
