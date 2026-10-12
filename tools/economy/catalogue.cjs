const { canForgeProduce } = require('../maps/load-generation-ts.cjs').loadGenerationTs(
  'app/lib/equipment/forgeProduction.ts'
)
const { FORGE_IRON_REQUIRED_LEVEL } = require('../maps/load-generation-ts.cjs').loadGenerationTs('app/config/forge.ts')
const { loadGenerationTs } = require('../maps/load-generation-ts.cjs')
const { HERO_CRAFT_RECIPES } = loadGenerationTs('app/lib/hero/heroCraftRecipes.ts')
const { FORGE_FAMILIES } = loadGenerationTs('app/lib/equipment/forgeUpgrades.ts')
const { getWorkToolTier } = loadGenerationTs('app/lib/equipment/workTools.ts')
const { hasIronMiningPickaxe } = loadGenerationTs('app/lib/resources/miningEquipment.ts')
const { EQUIPMENT_NAMES } = loadGenerationTs('app/lib/i18n/equipmentNames.ts')
const { equipmentVisualParts } = loadGenerationTs('app/lib/equipment/helmetVariants.ts')
const { CIVILIZATIONS } = loadGenerationTs('app/config/civilizations.ts')

function craftCatalogue() {
  const resourceRecipes = new Map(HERO_CRAFT_RECIPES.filter(r => r.outputResource).map(r => [r.outputResource, r]))
  function expand(cost, visiting = new Set()) {
    const result = {}
    for (const [resource, amount] of Object.entries(cost)) {
      const recipe = resourceRecipes.get(resource)
      if (!recipe) {
        result[resource] = (result[resource] ?? 0) + amount
        continue
      }
      if (visiting.has(resource)) throw new Error(`Cycle de craft : ${resource}`)
      const nested = expand(recipe.cost, new Set([...visiting, resource]))
      for (const [raw, value] of Object.entries(nested))
        result[raw] = (result[raw] ?? 0) + (value * amount) / recipe.outputCount
    }
    return result
  }
  return HERO_CRAFT_RECIPES.map(recipe => ({
    ...recipe,
    requiredForgeLevel:
      recipe.station === 'forge'
        ? canForgeProduce(recipe, { buildingLevel: 0 })
          ? 0
          : FORGE_IRON_REQUIRED_LEVEL
        : null,
    label:
      recipe.outputResource ||
      equipmentVisualParts(recipe.outputEquipment)
        .map(part => EQUIPMENT_NAMES[part]?.fr ?? part)
        .join(' · '),
    civilizations: recipe.civilizations ?? CIVILIZATIONS.map(civ => civ.value),
    rawCost: expand(recipe.cost),
    costPerOutput: Object.fromEntries(
      Object.entries(recipe.cost).map(([key, amount]) => [key, amount / recipe.outputCount])
    ),
  }))
}
function technologyCatalogue() {
  return [
    { tier: 0, resource: null, material: 'ceramic' },
    { tier: 2, resource: 'bronzeIngot', material: 'bronze' },
    { tier: 3, resource: 'ironIngot', material: 'iron' },
  ].map(material => {
    const worker = { inventory: { activeWeapons: { tool: `pickaxe_${material.material}` } } }
    const tier = getWorkToolTier(worker)
    return {
      ...material,
      families: [...FORGE_FAMILIES],
      woodBonus: tier,
      miningBonus: tier,
      buildMultiplier: 1 + tier * 0.25,
      canMineIron: hasIronMiningPickaxe(worker),
    }
  })
}
module.exports = { craftCatalogue, technologyCatalogue }
