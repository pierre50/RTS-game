import { migrateEquipmentMaterial } from './equipmentMaterials'
import { getLang } from '../lang'
import { EQUIPMENT_NAMES, UNKNOWN_EQUIPMENT_NAME } from '../i18n/equipmentNames'
import { equipmentBaseKey } from './equipmentCondition'
import { equipmentVisualParts } from './helmetVariants'

export function getEquipmentDisplayName(item: string): string {
  const language = getLang()
  const parts = equipmentVisualParts(migrateEquipmentMaterial(item))
  if (!parts.length) return UNKNOWN_EQUIPMENT_NAME[language]
  return parts
    .map(part => {
      const key = equipmentBaseKey(part)
      const name = Object.hasOwn(EQUIPMENT_NAMES, key)
        ? EQUIPMENT_NAMES[key as keyof typeof EQUIPMENT_NAMES]
        : UNKNOWN_EQUIPMENT_NAME
      return name[language]
    })
    .join(' · ')
}
