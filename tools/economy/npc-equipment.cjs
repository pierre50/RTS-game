const { loadGenerationTs: load } = require('../maps/load-generation-ts.cjs')
const { startingVillagerInventory } = load('app/lib/economy/startingProvisions.ts')
const { supplyTownTool, supplyTownWeapons } = load('app/lib/units/supplies/townToolSupply.ts')
const { getNpcWeaponChoice } = load('app/lib/units/combat/npcWeapons.ts')
const { hasRequiredWorkTool, canAutonomouslyWork } = load('app/lib/equipment/workTools.ts')
const { getEquipmentDurability } = load('app/lib/equipment/equipmentCondition.ts')
const { FORGE_EQUIPMENT_RECIPES } = load('app/lib/hero/heroForgeRecipes.ts')
const { createPlayerData } = load('app/config/playerConfig.ts')
const { dynamicEquipmentForUnit } = load('app/lib/lpc/equipment.ts')
const { EQUIPMENT_NAMES } = load('app/lib/i18n/equipmentNames.ts')
const equipment = require('../../public/assets/data/gameplay/equipment.json')
function fixture(item = 'axe_ceramic') {
  const center = {
    type: 'TownCenter',
    label: 'audit-town',
    i: 10,
    j: 10,
    isBuilt: true,
    inventory: { resources: { wood: 100, stone: 100, bronzeIngot: 100, ironIngot: 100 } },
  }
  const forge = { type: 'Forge', i: 11, j: 10, isBuilt: true }
  const owner = {
    label: 'audit-player',
    type: 'Human',
    isPlayed: true,
    buildings: [center, forge],
    config: { equipment },
  }
  const unit = {
    type: 'Villager',
    i: 12,
    j: 10,
    x: 0,
    y: 0,
    owner,
    inventory: {
      npcWeaponsInitialized: true,
      toolsInitialized: true,
      activeWeapons: { tool: `${item}~condition:0` },
      equipment: [],
    },
  }
  return { unit, owner, center, forge }
}
function consumed(before, after) {
  return Object.fromEntries(
    Object.entries(before)
      .map(([key, amount]) => [key, amount - (after[key] ?? 0)])
      .filter(([, n]) => n > 0)
  )
}
function npcEquipmentCatalogue() {
  const replacements = auditToolReplacements()
  const checks = []
  const check = (label, expected, actual) => checks.push({ label, expected, actual, passed: expected === actual })
  const residents = []
  for (let i = 0; i < 4; i++) residents.push({ type: 'Villager', inventory: startingVillagerInventory(residents) })
  check(
    'Répartition initiale : quatre types d’outils équipés',
    4,
    new Set(residents.map(u => u.inventory.activeWeapons.tool)).size
  )
  const archer = fixture()
  archer.unit.type = 'Bowman'
  archer.unit.inventory.equipment = ['bow', 'dagger_bronze~condition:0', 'sword_bronze']
  archer.center.inventory.resources.leather = 10
  check(
    'Archer : dague remplacée malgré un arc et une épée utilisables',
    true,
    supplyTownWeapons(archer.unit, archer.owner)
  )
  check(
    'Archer : conserve arc et dague',
    true,
    archer.unit.inventory.equipment.includes('bow') && archer.unit.inventory.equipment.includes('dagger_bronze')
  )
  archer.unit.inventory.equipment.push('dagger_iron~condition:0')
  check(
    'Archer : dague utilisable prioritaire sur une fabrication superflue',
    false,
    supplyTownWeapons(archer.unit, archer.owner)
  )
  const inactive = fixture()
  check(
    'Sans outil utilisable : aucune construction autonome',
    false,
    canAutonomouslyWork(inactive.unit, 'construction')
  )
  check('Sans outil utilisable : aucun travail pour les dépôts', false, canAutonomouslyWork(inactive.unit, 'wood'))
  const soldier = fixture()
  soldier.unit.type = 'Fantassin'
  soldier.unit.inventory.equipment = ['spear_bronze~condition:0']
  soldier.center.inventory.resources.fiber = 10
  check('Soldat rentré en ville : arme cassée remplacée', true, supplyTownWeapons(soldier.unit, soldier.owner))
  check('Lance remplacée : un lingot de bronze consommé', 99, soldier.center.inventory.resources.bronzeIngot)
  check('Arme remplacée : pas de deuxième fabrication', false, supplyTownWeapons(soldier.unit, soldier.owner))
  const f = fixture()
  f.unit.inventory.activeWeapons.tool = 'axe_ceramic'
  check('Hache équipée : couper du bois', true, hasRequiredWorkTool(f.unit, 'chopwood'))
  check('Hache équipée : miner sans pioche', false, hasRequiredWorkTool(f.unit, 'minestone'))
  check('Outil équipé sans arme : combat avec la hache', 'axe_ceramic', getNpcWeaponChoice(f.unit).weapon)
  f.unit.inventory.equipment.push('dagger_bronze')
  check('Dague utilisable prioritaire sur l’outil', 'dagger_bronze', getNpcWeaponChoice(f.unit).weapon)
  f.unit.inventory.equipment = ['dagger_bronze~condition:0']
  check('Dague cassée : repli vers l’outil équipé', 'axe_ceramic', getNpcWeaponChoice(f.unit).weapon)
  f.unit.inventory.equipment = ['bow', 'arrow_ceramic']
  f.unit.dest = { family: 'unit', x: 160, y: 0 }
  check('À distance avec flèches : arc', 'bow', getNpcWeaponChoice(f.unit).weapon)
  f.unit.inventory.equipment.pop()
  check('Sans flèches : outil équipé', 'axe_ceramic', getNpcWeaponChoice(f.unit).weapon)
  f.unit.inventory.activeWeapons.tool = 'axe_ceramic~condition:0'
  check('Outil cassé : mains nues', 'unarmed', getNpcWeaponChoice(f.unit).weapon ?? 'unarmed')
  for (const [label, change] of [
    [
      'Sans ressources : aucun remplacement',
      f => {
        f.center.inventory.resources = {}
      },
    ],
    [
      'Sans forge et sans pierre : métal non fabricable',
      f => {
        f.owner.buildings.pop()
        f.unit.inventory.activeWeapons.tool = 'axe_bronze~condition:0'
        f.center.inventory.resources.stone = 0
      },
    ],
    [
      'En combat : remplacement différé',
      f => {
        f.unit.action = 'attack'
      },
    ],
    [
      'Outil rangé : choix manuel respecté',
      f => {
        f.unit.inventory.toolsStowed = true
      },
    ],
    [
      'Héros : aucun remplacement automatique',
      f => {
        f.unit.type = 'Hero'
      },
    ],
  ]) {
    const sample = fixture()
    change(sample)
    check(label, false, supplyTownTool(sample.unit, sample.owner))
  }
  const rescue = fixture('axe_bronze')
  rescue.owner.buildings.pop()
  rescue.center.inventory.resources = {}
  check('Village vide : aucun outil gratuit', false, supplyTownTool(rescue.unit, rescue.owner))
  rescue.unit.inventory.resources = {
    ...FORGE_EQUIPMENT_RECIPES.find(recipe => recipe.outputEquipment === 'axe_ceramic').cost,
  }
  check('Matériaux du sac : outil en pierre fabriqué sans forge', true, supplyTownTool(rescue.unit, rescue.owner))
  check('Outil provisoire équipé', 'axe_ceramic', rescue.unit.inventory.activeWeapons.tool)
  check('Qualité métallique conservée pour la prochaine casse', 'axe_bronze', rescue.unit.inventory.toolSupplyTarget)
  check('Bois ramassé consommé', 0, rescue.unit.inventory.resources.wood)
  check('Pierre ramassée consommée', 0, rescue.unit.inventory.resources.stone)
  rescue.center.inventory.equipment ??= []
  rescue.center.inventory.equipment.push('axe_bronze')
  check(
    'Outil provisoire encore utilisable : aucune nouvelle fabrication',
    false,
    supplyTownTool(rescue.unit, rescue.owner)
  )
  rescue.unit.inventory.activeWeapons.tool = 'axe_ceramic~condition:0'
  check('Prochaine casse : retour au métal en stock', true, supplyTownTool(rescue.unit, rescue.owner))
  check('Outil métallique rééquipé', 'axe_bronze', rescue.unit.inventory.activeWeapons.tool)
  const stock = fixture()
  stock.forge.inventory = { equipment: ['axe_ceramic~condition:60'] }
  const before = structuredClone(stock.center.inventory.resources)
  check('Stock de forge utilisé avant de fabriquer', true, supplyTownTool(stock.unit, stock.owner))
  check(
    'Stock utilisé : aucun matériau dépensé',
    0,
    Object.keys(consumed(before, stock.center.inventory.resources)).length
  )
  const config = createPlayerData({ units: {}, buildings: {}, projectiles: {}, equipment }, 'Alba')
  const loadouts = [
    ['Bandit1', 'BanditChief'],
    ['Bandit2', 'BanditSword'],
    ['Bandit3', 'BanditArcher'],
  ].map(([label, type]) => ({ label, type, equipment: config.units[type].equipment }))
  for (const [tier, material] of [
    [0, 'ceramic'],
    [2, 'bronze'],
    [3, 'iron'],
  ]) {
    const items = dynamicEquipmentForUnit('Fantassin', { forgeUpgrades: { weapons: tier } }, 1, 'Alba')
    loadouts.push({
      label: `Fantassin — ${EQUIPMENT_NAMES[`spear_${material}`].fr}`,
      type: 'Fantassin',
      equipment: items,
    })
    check(`Fantassin : ${EQUIPMENT_NAMES[`spear_${material}`].fr}`, true, items.includes(`spear_${material}`))
  }
  check('Hallebarde retirée du catalogue', false, Object.hasOwn(equipment, 'halberd'))
  return { replacements, checks, loadouts, passed: replacements.every(r => r.passed) && checks.every(c => c.passed) }
}
function npcEquipmentSection(report, { table, row, escape, cost }) {
  const data = report.npcEquipment
  if (!data) return ''
  const name = item => EQUIPMENT_NAMES[item]?.fr ?? item
  const value = v => (typeof v === 'boolean' ? (v ? 'Oui' : 'Non') : v === 'unarmed' ? 'Mains nues' : name(v))
  return `<section id="npc-equipment"><h2>Outils et équipement des PNJ</h2>
<p>Un seul emplacement Outil, partagé entre travail et défense. Priorité au corps à corps : arme utilisable, puis outil équipé, puis poings. Les outils du sac ne sont pas sélectionnés automatiquement. À distance, l’arc conserve sa priorité avec des flèches. R range l’équipement du héros ; 1 reprend l’outil.</p>
${table(
  ['Unité', 'Équipement actuel'],
  data.loadouts.map(u => row([escape(u.label), u.equipment.map(item => escape(name(item))).join(', ')]))
)}
<p>L’autonomie tient compte de l’outil équipé avant de réserver du travail pour les chantiers et les dépôts. Si son outil est cassé, le villageois cherche les matériaux au sol pour son remplacement ; hache pour le bois, pioche pour les minerais, marteau pour construire. Les nouveaux villageois reçoivent en priorité les outils les moins représentés localement. Les soldats rentrés dans une ville utilisent d’abord une arme déjà portée en état et ne renouvellent qu’une arme nécessaire. Les archers conservent deux rôles indépendants : arme de tir et dague. Le stock de forge est utilisé avant une fabrication payée. Hors écran, un villageois sans outil utilisable revient près du centre ou du feu en consommant le temps de trajet avant tout remplacement.</p><h3>Remplacement automatique à 0 de durabilité</h3><p>La forge est nécessaire aux recettes métalliques, pas aux recettes manuelles ni à la prise d’un outil déjà en stock. Hors combat, le stock utilisable du même outil et du même matériau est pris en priorité ; sinon la recette normale est payée avec les ressources locales, sans prendre celles du héros. L’outil neuf remplace la copie cassée dans le même emplacement. Sans métal, un outil en pierre peut être fabriqué en payant sa recette, y compris avec les matériaux ramassés dans le sac. Une pénurie de matériaux reporte la fabrication ; aucun outil gratuit. Un outil absent ou rangé n’est pas recréé. Cette règle est également appliquée hors écran.</p>
${table(
  ['Outil', 'Recette actuelle', 'Consommation mesurée', 'Durabilité obtenue', 'Contrôle sans doublon'],
  data.replacements.map(r =>
    row([escape(r.label), cost(r.recipeCost), cost(r.consumed), r.durability, r.passed ? 'OK' : 'ÉCHEC'])
  )
)}
<h3>Scénarios exécutés avec les règles du jeu</h3>${table(
    ['Situation', 'Attendu', 'Observé', 'Résultat'],
    data.checks.map(c =>
      row([escape(c.label), escape(value(c.expected)), escape(value(c.actual)), c.passed ? 'OK' : 'ÉCHEC'])
    )
  )}
<p class="muted">Scènes isolées : aucun stock de partie n’est modifié. Ces contrôles vérifient les choix d’équipement et les paiements, pas les animations. Le remplacement se fait dans le périmètre de la ville ; le retour hors écran des travailleurs est testé séparément avec le moteur de simulation.</p></section>`
}
module.exports = { npcEquipmentCatalogue, npcEquipmentSection }

function auditToolReplacements() {
  return FORGE_EQUIPMENT_RECIPES.filter(r => /^(axe|pickaxe|hammer|scythe)_/.test(r.outputEquipment ?? '')).map(
    recipe => {
      const f = fixture(recipe.outputEquipment)
      const before = structuredClone(f.center.inventory.resources)
      const replaced = supplyTownTool(f.unit, f.owner)
      const paid = consumed(before, f.center.inventory.resources)
      const repeated = supplyTownTool(f.unit, f.owner)
      const costMatches = Object.keys({ ...paid, ...recipe.cost }).every(
        key => (paid[key] ?? 0) === (recipe.cost[key] ?? 0)
      )
      return {
        item: recipe.outputEquipment,
        label: EQUIPMENT_NAMES[recipe.outputEquipment]?.fr ?? recipe.outputEquipment,
        recipeCost: recipe.cost,
        consumed: paid,
        durability: getEquipmentDurability(f.unit.inventory.activeWeapons.tool),
        passed: replaced && !repeated && costMatches && f.unit.inventory.activeWeapons.tool === recipe.outputEquipment,
      }
    }
  )
}
