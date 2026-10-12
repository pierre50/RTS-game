import type { UnitEntity } from '../../types/entities'

/** A paid archer conversion includes its first ammunition; mounting an archer does not. */
export function trainedInventory(
  previousType: string | undefined,
  type: string,
  inventory: UnitEntity['inventory']
): UnitEntity['inventory'] {
  const result = inventory ? structuredClone(inventory) : undefined
  if (type !== 'Bowman' || previousType === 'Bowman') return result
  const equipped = result ?? {}
  equipped.equipment ??= []
  const count = equipped.equipment.filter(item => item.startsWith('arrow_')).length
  if (count < 20) equipped.equipment.push(...Array<string>(20 - count).fill('arrow_ceramic'))
  equipped.npcArrows = { initialized: true }
  return equipped
}
