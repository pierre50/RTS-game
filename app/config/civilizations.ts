export interface Civilization {
  labelKey: string
  value: string
  disabledUnits: string[]
  disabledTechnologies: string[]
}

export const CIVILIZATIONS: Civilization[] = [
  { labelKey: 'civHellas', value: 'Hellas', disabledUnits: [], disabledTechnologies: [] },
  { labelKey: 'civLatium', value: 'Latium', disabledUnits: [], disabledTechnologies: [] },
  { labelKey: 'civKemet', value: 'Kemet', disabledUnits: [], disabledTechnologies: [] },
  { labelKey: 'civSumeria', value: 'Sumeria', disabledUnits: [], disabledTechnologies: [] },
  { labelKey: 'civXia', value: 'Xia', disabledUnits: [], disabledTechnologies: [] },
  { labelKey: 'civAlba', value: 'Alba', disabledUnits: [], disabledTechnologies: [] },
  { labelKey: 'civNord', value: 'Nord', disabledUnits: [], disabledTechnologies: [] },
  { labelKey: 'civNobatia', value: 'Nobatia', disabledUnits: [], disabledTechnologies: [] },
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
