export const CIVILIZATIONS = [
  { labelKey: 'civGreek', value: 'Greek', disabledUnits: [], disabledTechnologies: [] },
  { labelKey: 'civEgyptian', value: 'Egyptian', disabledUnits: [], disabledTechnologies: [] },
  { labelKey: 'civBabylonian', value: 'Babylonian', disabledUnits: [], disabledTechnologies: [] },
  { labelKey: 'civAsian', value: 'Asian', disabledUnits: [], disabledTechnologies: [] },
]

const CIVILIZATION_BY_NAME = CIVILIZATIONS.reduce((result, civilization) => {
  result[civilization.value] = civilization
  return result
}, {})

export function getCivilizationDefinition(name) {
  return CIVILIZATION_BY_NAME[name] || CIVILIZATION_BY_NAME.Greek
}
