import { isObject, fail } from './SaveValidationPrimitives'

/** Old campaigns have no journal. Present journals must be valid before entering the runtime. */
export function validateQuestJournal(value: unknown): void {
  if (value === undefined) return
  const invalid = (): never => fail('Invalid save file: quest journal is invalid.')
  const strings = (entry: unknown): boolean =>
    isObject(entry) && Object.values(entry).every(item => typeof item === 'string')
  if (!isObject(value) || value.version !== 1 || !Array.isArray(value.quests)) return invalid()
  if (
    value.villageRelations !== undefined &&
    (!isObject(value.villageRelations) ||
      !Object.values(value.villageRelations).every(
        score => typeof score === 'number' && Number.isInteger(score) && score >= -100 && score <= 100
      ))
  )
    return invalid()
  const ids = new Set<string>()
  for (const quest of value.quests) {
    if (!isObject(quest)) return invalid()
    const reservation = quest.reservation
    if (reservation !== undefined && (!isObject(reservation) ||
      !['entityLabels', 'stageIds'].every(key => Array.isArray(reservation[key]) &&
        (reservation[key] as unknown[]).every(value => typeof value === 'string')))) return invalid()
    if (quest.repeatable !== undefined && typeof quest.repeatable !== 'boolean') return invalid()
    for (const key of ['completedDay', 'nextOfferDay']) {
      if (quest[key] !== undefined && (typeof quest[key] !== 'number' || !Number.isSafeInteger(quest[key]) || quest[key] < 1))
        return invalid()
    }
    for (const key of ['id', 'definitionId', 'regionId', 'stageId']) {
      if (typeof quest[key] !== 'string' || !quest[key]) return invalid()
    }
    if (ids.has(quest.id as string)) return invalid()
    ids.add(quest.id as string)
    const owner = quest.owner
    if (!isObject(owner) || !['entityLabel', 'playerLabel', 'name'].every(key => typeof owner[key] === 'string'))
      return invalid()
    if (!['available', 'active', 'completed', 'failed', 'cancelled'].includes(String(quest.status))) return invalid()
    if (quest.assigneeId !== null && (typeof quest.assigneeId !== 'string' || !quest.assigneeId)) return invalid()
    if (quest.status === 'available' ? quest.assigneeId !== null : quest.assigneeId === null) return invalid()
    if (
      !strings(quest.bindings) ||
      !isObject(quest.parameters) ||
      !Object.values(quest.parameters).every(
        item => typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item))
      )
    )
      return invalid()
    if (!isObject(quest.facts) || !Object.values(quest.facts).every(item => typeof item === 'boolean')) return invalid()
    if (
      typeof quest.unread !== 'boolean' ||
      !Array.isArray(quest.usedInteractions) ||
      !quest.usedInteractions.every(item => typeof item === 'string')
    )
      return invalid()
    if (!isObject(quest.markers)) return invalid()
    for (const markers of Object.values(quest.markers)) {
      if (!Array.isArray(markers)) return invalid()
      for (const marker of markers) {
        if (
          !isObject(marker) ||
          typeof marker.id !== 'string' ||
          typeof marker.spaceId !== 'string' ||
          !isObject(marker.position) ||
          ![marker.position.i, marker.position.j].every(item => typeof item === 'number' && Number.isFinite(item)) ||
          !isObject(marker.label) ||
          typeof marker.label.key !== 'string'
        )
          return invalid()
        if (
          marker.label.vars !== undefined &&
          (!isObject(marker.label.vars) ||
            !Object.values(marker.label.vars).every(
              item => typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item))
            ))
        )
          return invalid()
        if (
          marker.radius !== undefined &&
          (typeof marker.radius !== 'number' || !Number.isFinite(marker.radius) || marker.radius <= 0)
        )
          return invalid()
      }
    }
  }
  if (
    value.trackedQuestId !== null &&
    !value.quests.some(quest => quest.id === value.trackedQuestId && quest.status === 'active')
  )
    invalid()
}
