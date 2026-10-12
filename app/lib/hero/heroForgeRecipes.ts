import { isCurrentEquipment } from '../equipment/equipmentMaterials'
import { SOLDIER_CIVILIZATION_HELMET_EQUIPMENT } from '../lpc/civilizationHelmets'
import { SOLDIER_CIVILIZATION_DECORATION_EQUIPMENT } from '../lpc/civilizationHelmetDecorations'
import { decorateHelmet } from '../equipment/helmetVariants'
import type { ResourceAmount } from '../../types/common'
import type { DynamicEquipmentKey } from '../lpc/equipmentData'
import type { HeroCraftRecipe } from './heroCraftRecipes'

type ForgePattern = {
  prefix: string
  suffix?: string
  group: NonNullable<HeroCraftRecipe['forgeGroup']>
  metal: number
  supplies: ResourceAmount
  civilizations?: string[]
}

// Material quantities reflect helmet coverage; ornaments are priced separately below.
const HELMET_COSTS: Record<string, { metal: number; leather: number }> = {
  helmet_pointed: { metal: 6, leather: 1 },
  helmet_nasal: { metal: 9, leather: 1 },
  helmet_norman: { metal: 9, leather: 1 },
  helmet_bascinet_round: { metal: 9, leather: 2 },
  helmet_legion: { metal: 12, leather: 2 },
  helmet_barbuta: { metal: 15, leather: 2 },
}

// These recipes make equippable tools, weapons and armor.
const PATTERNS: readonly ForgePattern[] = [
  { prefix: 'spear', group: 'weapons', metal: 3, supplies: { wood: 6, fiber: 1 } },
  { prefix: 'sword', group: 'weapons', metal: 6, supplies: { wood: 2, leather: 1 } },
  ...['axe', 'pickaxe', 'hammer', 'scythe'].map(prefix => ({
    prefix,
    group: 'weapons' as const,
    metal: 5,
    supplies: { wood: 4 },
  })),
  { prefix: 'armor_mail', group: 'armor', metal: 14, supplies: { leather: 3 } },
  { prefix: 'armor_legion', group: 'armor', metal: 18, supplies: { leather: 4 } },
  ...[{ equipment: 'helmet_pointed_bronze' }, ...SOLDIER_CIVILIZATION_HELMET_EQUIPMENT].flatMap(entry => {
    if (typeof entry === 'string') return []
    const prefix = entry.equipment.replace(/_(ceramic|bronze)$/, '')
    const cost = HELMET_COSTS[prefix]!
    return [
      {
        prefix,
        group: 'armor' as const,
        metal: cost.metal,
        supplies: { leather: cost.leather },
        civilizations: 'civilizations' in entry ? entry.civilizations : undefined,
      },
    ]
  }),
  { prefix: 'shoulder_legion', group: 'armor', metal: 5, supplies: { leather: 2 } },
  { prefix: 'bracers', group: 'armor', metal: 3, supplies: { leather: 1 } },
  { prefix: 'leg_armor', group: 'armor', metal: 7, supplies: { leather: 2 } },
  {
    prefix: 'round_shield',
    suffix: '_slash',
    group: 'shields',
    metal: 5,
    supplies: { wood: 6, leather: 2 },
  },
]

const MATERIALS = ['ceramic', 'bronze', 'iron'] as const

const BASE_FORGE_EQUIPMENT_RECIPES: readonly HeroCraftRecipe[] = [
  {
    id: 'slingshot',
    outputEquipment: 'slingshot',
    station: 'inventory',
    category: 'equipment',
    forgeGroup: 'weapons',
    descriptionKey: 'craftManualEquipmentDescription',
    outputCount: 1,
    cost: { wood: 2, leather: 1, sinew: 1 },
  },
  ...[
    ['armor_leather', { leather: 5, fiber: 2 }],
    ['helmet_pointed_leather', { leather: 2, fiber: 1 }],
    ['shoulder_legion_leather', { leather: 2, fiber: 1 }],
    ['bracers_leather', { leather: 1, fiber: 1 }],
    ['leg_armor_leather', { leather: 3, fiber: 1 }],
    ['round_shield_wood_slash', { wood: 6, leather: 2 }],
  ].map(([id, cost]) => ({
    id: id as string,
    outputEquipment: id as string,
    cost: cost as ResourceAmount,
    station: 'inventory' as const,
    category: 'equipment' as const,
    descriptionKey: 'craftManualEquipmentDescription',
    forgeGroup: id === 'round_shield_wood_slash' ? ('shields' as const) : ('armor' as const),
    outputCount: 1,
  })),
  ...(['dagger', 'mace'] as const).flatMap(weapon =>
    (['bronze', 'iron'] as const).map(material => ({
      id: `${weapon}_${material}`,
      outputEquipment: `${weapon}_${material}`,
      station: 'forge' as const,
      category: 'equipment' as const,
      forgeGroup: 'weapons' as const,
      materialKey: `forgeMaterial_${material}`,
      descriptionKey: 'craftForgeDescription_weapons',
      outputCount: 1,
      cost: { [`${material}Ingot`]: weapon === 'mace' ? 2 : 1, wood: weapon === 'mace' ? 3 : 1, leather: 1 },
    }))
  ),
  ...PATTERNS.flatMap(pattern =>
    MATERIALS.filter(material => isCurrentEquipment(`${pattern.prefix}_${material}${pattern.suffix ?? ''}`)).map(
      material => {
        const equipment = `${pattern.prefix}_${material}${pattern.suffix ?? ''}`
        // One ingot represents three ore; retain comparable mining costs for each piece.
        const metalCost = Math.ceil(pattern.metal / 3)
        return {
          id: equipment,
          station: material === 'ceramic' ? ('inventory' as const) : ('forge' as const),
          category: 'equipment' as const,
          forgeGroup: pattern.group,
          civilizations: pattern.civilizations,
          materialKey: `forgeMaterial_${material}`,
          descriptionKey:
            material === 'ceramic' ? 'craftManualEquipmentDescription' : `craftForgeDescription_${pattern.group}`,
          outputEquipment: equipment,
          outputCount: 1,
          cost: {
            ...pattern.supplies,
            ...(material === 'ceramic' ? { stone: pattern.metal } : { [`${material}Ingot`]: metalCost }),
          },
        }
      }
    )
  ),
  ...([['longsword', { ironIngot: 4, wood: 3, leather: 2 }]] satisfies [DynamicEquipmentKey, ResourceAmount][]).map(
    ([equipment, cost]) => ({
      id: equipment,
      station: 'forge' as const,
      category: 'equipment' as const,
      forgeGroup: 'weapons' as const,
      descriptionKey: 'craftForgeDescription_weapons',
      outputEquipment: equipment,
      outputCount: 1,
      cost,
    })
  ),
]

// Reuse the civilization ornaments worn by soldiers; never offer another culture's decoration.
export const FORGE_EQUIPMENT_RECIPES: readonly HeroCraftRecipe[] = BASE_FORGE_EQUIPMENT_RECIPES.flatMap(recipe => {
  if (!recipe.outputEquipment.startsWith('helmet_')) return [recipe]
  return [
    recipe,
    ...SOLDIER_CIVILIZATION_DECORATION_EQUIPMENT.flatMap(entry => {
      if (typeof entry === 'string') return []
      const civilizations = entry.civilizations?.filter(
        civ => !recipe.civilizations || recipe.civilizations.includes(civ)
      )
      if (!civilizations?.length) return []
      return [
        {
          ...recipe,
          id: `${recipe.id}~decor:${entry.equipment}`,
          outputEquipment: decorateHelmet(recipe.outputEquipment, [entry.equipment]),
          civilizations,
          decorated: true,
          cost: { ...recipe.cost, leather: (recipe.cost.leather ?? 0) + 2 },
        },
      ]
    }),
  ]
})

/** All materials of the same model share a row; helmet decorations remain distinct choices. */
export function groupForgeRecipeVariants(recipes: readonly HeroCraftRecipe[]): HeroCraftRecipe[][] {
  const groups = new Map<string, HeroCraftRecipe[]>()
  for (const recipe of recipes) {
    const key =
      recipe.category === 'equipment' || recipe.category === 'arrows'
        ? recipe.outputEquipment.replace(/_(wood|leather|ceramic|copper|bronze|iron)(?=_|~|$)/, '')
        : recipe.id
    const group = groups.get(key) ?? []
    group.push(recipe)
    groups.set(key, group)
  }
  return [...groups.values()]
}
