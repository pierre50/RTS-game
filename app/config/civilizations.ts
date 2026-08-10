export interface Civilization {
  labelKey: string
  value: string
  disabledUnits: string[]
  disabledTechnologies: string[]
}

export const CIVILIZATIONS: Civilization[] = [
  { labelKey: 'civGreek', value: 'Greek', disabledUnits: [], disabledTechnologies: [] },
  { labelKey: 'civRoman', value: 'Roman', disabledUnits: [], disabledTechnologies: [] },
  { labelKey: 'civEgyptian', value: 'Egyptian', disabledUnits: [], disabledTechnologies: [] },
  { labelKey: 'civBabylonian', value: 'Babylonian', disabledUnits: [], disabledTechnologies: [] },
  { labelKey: 'civAsian', value: 'Asian', disabledUnits: [], disabledTechnologies: [] },
  { labelKey: 'civCeltic', value: 'Celtic', disabledUnits: [], disabledTechnologies: [] },
  { labelKey: 'civNordic', value: 'Nordic', disabledUnits: [], disabledTechnologies: [] },
  { labelKey: 'civNubian', value: 'Nubian', disabledUnits: [], disabledTechnologies: [] },
]

const CIVILIZATION_BY_NAME: Record<string, Civilization> = CIVILIZATIONS.reduce(
  (result: Record<string, Civilization>, civilization) => {
    result[civilization.value] = civilization
    return result
  },
  {}
)

export function getCivilizationDefinition(name: string): Civilization {
  return CIVILIZATION_BY_NAME[name] || CIVILIZATION_BY_NAME.Greek
}
