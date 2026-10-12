import { ARROW_BATCH_SIZE, ARROW_RECIPES } from '../equipment/arrowRecipes'
import { FORGE_EQUIPMENT_RECIPES } from './heroForgeRecipes'
import type { ResourceAmount } from '../../types/common'

export type HeroCraftRecipe = {
  station: 'forge' | 'campfire' | 'inventory'
  category: 'equipment' | 'arrows' | 'cooking' | 'potions' | 'ingots'
  forgeGroup?: 'weapons' | 'armor' | 'shields'
  civilizations?: string[]
  decorated?: boolean
  materialKey?: string
  descriptionKey?: string
  iconResource?: keyof ResourceAmount
  id: string
  outputResource?: 'bronzeIngot' | 'ironIngot'
  outputEquipment: string
  outputCount: number
  cost: ResourceAmount
}

export const HERO_TRAP_ITEM = 'trap'
export const HERO_CHEST_ITEM = 'chest'
export const HERO_CAMPFIRE_ITEM = 'campfire'
export const HERO_HEALING_POULTICE_ITEM = 'healing_poultice'
export const HERO_POISON_VIAL_ITEM = 'poison_vial'
export const HERO_FIBER_BANDAGE_ITEM = 'fiber_bandage'
export const HERO_GRILLED_MEAT_ITEM = 'grilled_meat'

export const HERO_CRAFT_RECIPES: readonly HeroCraftRecipe[] = [
  ...FORGE_EQUIPMENT_RECIPES,
  ...(['bronzeIngot', 'ironIngot'] as const).map(resource => ({
    id: resource,
    station: 'forge' as const,
    category: 'ingots' as const,
    descriptionKey: 'craftIngotDescription',
    iconResource: resource,
    outputResource: resource,
    outputEquipment: '',
    outputCount: 1,
    cost: resource === 'bronzeIngot' ? { copper: 2, tin: 1, wood: 2 } : { iron: 3, wood: 2 },
  })),
  {
    id: HERO_GRILLED_MEAT_ITEM,
    station: 'campfire',
    category: 'cooking',

    descriptionKey: 'craftGrilledMeatDescription',
    iconResource: 'meat',
    outputEquipment: HERO_GRILLED_MEAT_ITEM,
    outputCount: 1,
    cost: { meat: 2 },
  },
  {
    id: 'bow',
    station: 'inventory',
    category: 'equipment',

    descriptionKey: 'craftBowDescription',
    outputEquipment: 'bow',
    outputCount: 1,
    cost: { wood: 5, sinew: 2 },
  },
  {
    id: 'catchingPole',
    station: 'inventory',
    category: 'equipment',

    descriptionKey: 'craftCatchingPoleDescription',
    outputEquipment: 'catchingPole',
    outputCount: 1,
    cost: { wood: 4, fiber: 2 },
  },
  {
    id: HERO_HEALING_POULTICE_ITEM,
    station: 'inventory',
    category: 'potions',

    descriptionKey: 'craftHealingPoulticeDescription',
    iconResource: 'herb',
    outputEquipment: HERO_HEALING_POULTICE_ITEM,
    outputCount: 1,
    cost: { herb: 2, fiber: 1 },
  },
  {
    id: HERO_POISON_VIAL_ITEM,
    station: 'campfire',
    category: 'potions',

    descriptionKey: 'craftPoisonVialDescription',
    iconResource: 'toxicHerb',
    outputEquipment: HERO_POISON_VIAL_ITEM,
    outputCount: 1,
    cost: { toxicHerb: 2 },
  },
  {
    id: HERO_FIBER_BANDAGE_ITEM,
    station: 'inventory',
    category: 'potions',

    descriptionKey: 'craftFiberBandageDescription',
    iconResource: 'fiber',
    outputEquipment: HERO_FIBER_BANDAGE_ITEM,
    outputCount: 1,
    cost: { fiber: 3 },
  },
  ...ARROW_RECIPES.map(recipe => ({
    id: recipe.item,
    station: recipe.item === 'arrow_ceramic' ? ('inventory' as const) : ('forge' as const),
    category: 'arrows' as const,

    descriptionKey: 'craftArrowDescription',
    outputEquipment: recipe.item,
    outputCount: 1,
    cost: Object.fromEntries(
      Object.entries(recipe.cost).map(([resource, amount]) => [resource, amount / ARROW_BATCH_SIZE])
    ),
  })),
]
