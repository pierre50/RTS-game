export interface Civilization {
  labelKey: string
  value: string
  disabledUnits: string[]
}

export const CIVILIZATIONS: Civilization[] = [
  { labelKey: 'civHellas', value: 'Hellas', disabledUnits: [] },
  { labelKey: 'civLatium', value: 'Latium', disabledUnits: [] },
  { labelKey: 'civKemet', value: 'Kemet', disabledUnits: [] },
  { labelKey: 'civSumeria', value: 'Sumeria', disabledUnits: [] },
  { labelKey: 'civXia', value: 'Xia', disabledUnits: [] },
  { labelKey: 'civAlba', value: 'Alba', disabledUnits: [] },
  { labelKey: 'civNord', value: 'Nord', disabledUnits: [] },
  { labelKey: 'civNobatia', value: 'Nobatia', disabledUnits: [] },
]

const CIVILIZATION_BY_NAME: Record<string, Civilization> = CIVILIZATIONS.reduce(
  (result: Record<string, Civilization>, civilization) => {
    result[civilization.value] = civilization
    return result
  },
  {}
)

export function getCivilizationDefinition(name: string): Civilization {
  return CIVILIZATION_BY_NAME[name] || CIVILIZATION_BY_NAME.Hellas
}
