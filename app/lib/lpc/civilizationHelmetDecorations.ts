import type { UnitEquipmentDefinition } from './equipmentData'

export const SOLDIER_CIVILIZATION_DECORATION_EQUIPMENT: readonly UnitEquipmentDefinition[] = [
  // One entry per decoration: forge recipe ids are derived from it and must stay unique.
  { equipment: 'centurion_crest', civilizations: ['Hellas', 'Latium'], minLevel: 16 },
  { equipment: 'legion_plumage', civilizations: ['Sumeria'], minLevel: 16 },
  { equipment: 'plumage', civilizations: ['Kemet', 'Xia', 'Nobatia'], minLevel: 16 },
  { equipment: 'helmet_wings', civilizations: ['Alba'], minLevel: 16 },
  { equipment: 'upward_horns_white', civilizations: ['Nord'], minLevel: 16 },
]
