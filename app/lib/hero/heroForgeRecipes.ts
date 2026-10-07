import type { ResourceAmount } from '../../types/common'
import type { DynamicEquipmentKey } from '../lpc/equipmentData'
import type { HeroCraftRecipe } from './heroCrafting'

type ForgePattern = {
  prefix: string
  suffix?: string
  labelKey: string
  group: NonNullable<HeroCraftRecipe['forgeGroup']>
  metal: number
  supplies: ResourceAmount
}

// Work tools are supplied by village research; these recipes make equippable personal gear.
const PATTERNS: readonly ForgePattern[] = [
  { prefix: 'sword', labelKey: 'craftForgeSword', group: 'weapons', metal: 6, supplies: { wood: 2, leather: 1 } },
  { prefix: 'axe', labelKey: 'craftForgeAxe', group: 'weapons', metal: 5, supplies: { wood: 4 } },
  { prefix: 'armor_mail', labelKey: 'craftForgeMail', group: 'armor', metal: 14, supplies: { leather: 3 } },
  { prefix: 'armor_legion', labelKey: 'craftForgeLegionArmor', group: 'armor', metal: 18, supplies: { leather: 4 } },
  ...['pointed', 'barbuta', 'legion', 'nasal', 'bascinet_round', 'norman'].map(style => ({
    prefix: `helmet_${style}`,
    labelKey: `craftForgeHelmet_${style}`,
    group: 'armor' as const,
    metal: 6,
    supplies: { leather: 1 },
  })),
  { prefix: 'shoulder_legion', labelKey: 'craftForgeShoulders', group: 'armor', metal: 5, supplies: { leather: 2 } },
  { prefix: 'bracers', labelKey: 'craftForgeBracers', group: 'armor', metal: 3, supplies: { leather: 1 } },
  { prefix: 'leg_armor', labelKey: 'craftForgeLegs', group: 'armor', metal: 7, supplies: { leather: 2 } },
  {
    prefix: 'round_shield',
    suffix: '_slash',
    labelKey: 'craftForgeShield',
    group: 'shields',
    metal: 5,
    supplies: { wood: 6, leather: 2 },
  },
]

const MATERIALS = ['copper', 'bronze', 'iron'] as const

export const FORGE_EQUIPMENT_RECIPES: readonly HeroCraftRecipe[] = [
  ...PATTERNS.flatMap(pattern =>
    MATERIALS.map(material => {
      const equipment = `${pattern.prefix}_${material}${pattern.suffix ?? ''}`
      // One ingot represents three ore; retain comparable mining costs for each piece.
      const metalCost = Math.ceil(pattern.metal / 3)
      return {
        id: equipment,
        station: 'forge' as const,
        category: 'equipment' as const,
        forgeGroup: pattern.group,
        labelKey: pattern.labelKey,
        materialKey: `forgeMaterial_${material}`,
        descriptionKey: `craftForgeDescription_${pattern.group}`,
        outputEquipment: equipment,
        outputCount: 1,
        cost: { ...pattern.supplies, [`${material}Ingot`]: metalCost },
      }
    })
  ),
  ...(
    [
      ['longsword', 'craftForgeLongsword', { ironIngot: 4, wood: 3, leather: 2 }],
      ['halberd', 'craftForgeHalberd', { ironIngot: 4, wood: 8, leather: 2 }],
    ] satisfies [DynamicEquipmentKey, string, ResourceAmount][]
  ).map(([equipment, labelKey, cost]) => ({
    id: equipment,
    station: 'forge' as const,
    category: 'equipment' as const,
    forgeGroup: 'weapons' as const,
    labelKey,
    descriptionKey: 'craftForgeDescription_weapons',
    outputEquipment: equipment,
    outputCount: 1,
    cost,
  })),
]
