import { MAX_TRAFFIC_GROUPS } from '../../services/travel/ambient/AmbientTrafficState'
import { fail, isObject } from './SaveValidationPrimitives'
import { validatePlayerUnits } from './SaveUnitValidators'
import type { LoadedGameConfig } from '../../types/save'

export function validateAmbientTraffic(value: unknown, size: number, config: LoadedGameConfig): void {
  if (value == null) return
  const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 512
  const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
  const point = (value: unknown): value is Record<string, unknown> & { i: number; j: number } =>
    isObject(value) &&
    Number.isInteger(value.i) &&
    Number.isInteger(value.j) &&
    Number(value.i) >= 0 &&
    Number(value.j) >= 0 &&
    Number(value.i) <= size &&
    Number(value.j) <= size
  if (
    !isObject(value) ||
    value.version !== 1 ||
    !Array.isArray(value.groups) ||
    value.groups.length > MAX_TRAFFIC_GROUPS
  )
    fail('Invalid ambient traffic state.')
  const ids = new Set<string>(),
    labels = new Set<string>()
  for (const group of value.groups) {
    if (
      !isObject(group) ||
      !text(group.id) ||
      ids.has(group.id) ||
      !text(group.owner) ||
      typeof group.kind !== 'string' ||
      !['villagers', 'military', 'bandits'].includes(group.kind) ||
      !point(group.from) ||
      !point(group.to) ||
      !text(group.from.label) ||
      !text(group.from.owner) ||
      !text(group.to.label) ||
      !text(group.to.owner) ||
      (group.from.name != null && !text(group.from.name)) ||
      (group.to.name != null && !text(group.to.name)) ||
      !Array.isArray(group.route) ||
      group.route.length < 2 ||
      group.route.length > 8192 ||
      group.route.some((p: unknown) => !point(p)) ||
      !number(group.progress) ||
      group.progress > group.route.length - 1 ||
      typeof group.reverse !== 'boolean' ||
      !number(group.pauseMs) ||
      group.pauseMs > 45000 ||
      (group.materialized != null && typeof group.materialized !== 'boolean') ||
      (group.retired != null && typeof group.retired !== 'boolean') ||
      (group.kind === 'bandits' &&
        (!text(group.campId) || !Number.isSafeInteger(group.campGeneration) || Number(group.campGeneration) < 0)) ||
      !Array.isArray(group.members) ||
      !group.members.length ||
      group.members.length > 3
    )
      fail('Invalid ambient traffic group.')
    ids.add(group.id)
    for (let n = 1; n < group.route.length; n++)
      if (Math.hypot(group.route[n].i - group.route[n - 1].i, group.route[n].j - group.route[n - 1].j) > Math.SQRT2)
        fail('Disconnected ambient route.')
    for (const member of group.members) {
      if (
        !isObject(member) ||
        !text(member.label) ||
        labels.has(member.label) ||
        typeof member.type !== 'string' ||
        !['Villager', 'Fantassin', 'Bowman', 'BanditSword', 'BanditArcher'].includes(member.type)
      )
        fail('Invalid ambient traveler.')
      labels.add(member.label)
    }
    validatePlayerUnits(group.members, 0, size, config)
  }
}
