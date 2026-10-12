const { loadGenerationTs: load } = require('../maps/load-generation-ts.cjs')
const { getEquipmentMaxUses } = load('app/lib/equipment/equipmentCondition.ts')
const { getEquipmentRepairCost } = load('app/lib/equipment/equipmentRepair.ts')
const xp = load('app/lib/units/unitExperience.ts')
const forge = load('app/lib/equipment/forgeUpgrades.ts')
const { getEquipmentCombatStats, UNARMED_UNIT_WEAPON_POWER } = load('app/lib/equipment/equipmentStats.ts')
const { getHitPointsWithDamage } = load('app/lib/combat/combat.ts')
const { getWorkGatherAmount, getResourceGatherSwings } = load('app/lib/economy/workRules.ts')
const { EQUIPMENT_NAMES } = load('app/lib/i18n/equipmentNames.ts')
const { getEquipmentSlot } = load('app/lib/equipment/equipmentSlots.ts')
const { getWorkToolTier, workToolFamily } = load('app/lib/equipment/workTools.ts')
const { getConfiguredActionFrameSequence } = load('app/lib/animations/actionFrameSequences.ts')
const { HERO_POWER_CHARGE_MS, getHeroSwordChargeDamageMultiplier, canHeroDefendWithTool } = load(
  'app/lib/hero/heroCombatRules.ts'
)
const { getBaseActionEnergyCost } = load('app/lib/units/energyRules.ts')
const materials = ['Pierre', 'Cuivre', 'Bronze', 'Fer']
function performanceCatalogue(equipment, units) {
  const slotMax = {}
  const armorItems = Object.entries(equipment)
    .filter(([, def]) => def.armor > 0)
    .map(([id, def]) => {
      const slot = getEquipmentSlot(id)
      if (slot) slotMax[slot] = Math.max(slotMax[slot] ?? 0, def.armor)
      return { id, label: EQUIPMENT_NAMES[id]?.fr ?? id, slot, armor: def.armor }
    })
  const heroBaseArmor = units.Hero?.armor ?? 0
  const maxArmor = Math.ceil(Object.values(slotMax).reduce((n, a) => n + a, 0) + heroBaseArmor)
  const armorValues = Array.from({ length: maxArmor + 1 }, (_, i) => i)
  const armorSets = [0, 2, 3].map(tier => {
    const material = forge.FORGE_MATERIALS[tier]
    const items = ['armor_mail_', 'helmet_pointed_', 'shoulder_legion_', 'bracers_', 'leg_armor_']
      .map(prefix => prefix + material)
      .concat('round_shield_' + material + '_slash')
      .map(item => forge.resolveForgeEquipment(item, { forgeUpgrades: { armor: tier } }))
    const armor = getEquipmentCombatStats(items, equipment).armor
    return { material: materials[tier], items, armor, heroArmor: heroBaseArmor + armor }
  })
  const label = id => EQUIPMENT_NAMES[id]?.fr ?? id
  const weapons = Object.entries(equipment)
    .filter(([id, def]) => def.weapon?.power > 0 && !/^(bow|arrow)/.test(id))
    .map(([id]) => ({
      id,
      label: label(id),
      items: [id],
      category: id === 'slingshot' ? 'ranged' : 'melee',
      tool: Boolean(workToolFamily(id)),
    }))
  weapons.unshift({ id: 'unarmed', label: 'Mains nues', items: [], category: 'melee' })
  for (const bow of Object.keys(equipment).filter(id => /^bow($|_)/.test(id)))
    for (const arrow of Object.keys(equipment).filter(id => /^arrow_/.test(id)))
      weapons.push({
        id: `${bow}+${arrow}`,
        label: `${label(bow)} + ${label(arrow)}`,
        items: [bow, arrow],
        category: 'ranged',
      })
  const levels = Array.from({ length: xp.XP_MAX_LEVEL }, (_, i) => i + 1)
  for (const weapon of weapons) {
    weapon.maxUses = weapon.items.length ? getEquipmentMaxUses(weapon.items[0]) : null
    weapon.repairCost = weapon.items.length ? getEquipmentRepairCost(weapon.items[0] + '~condition:0') : {}
    weapon.animationSequence = getConfiguredActionFrameSequence({ action: 'attack', equipment: weapon.items })
    weapon.power = weapon.items.length
      ? getEquipmentCombatStats(weapon.items, equipment).weaponPower
      : UNARMED_UNIT_WEAPON_POWER
    const meleeCharge = weapon.category === 'melee' && weapon.id !== 'unarmed' && weapon.id !== 'catchingPole'
    const mode = weapon.tool || weapon.id === 'unarmed' ? 'interact' : weapon.category === 'ranged' ? 'bow' : 'sword'
    const canBlock = canHeroDefendWithTool(mode, {
      inventory: { activeWeapons: { tool: weapon.tool ? weapon.id : undefined } },
    })
    weapon.heroCombat = {
      chargeMs: meleeCharge ? HERO_POWER_CHARGE_MS : null,
      chargedPower: meleeCharge ? Math.round(weapon.power * getHeroSwordChargeDamageMultiplier(1)) : null,
      canBlock,
      strikeEnergy: getBaseActionEnergyCost(units.Hero?.energyCosts, 'attack'),
      chargedStrikeEnergy: meleeCharge
        ? getBaseActionEnergyCost(units.Hero?.energyCosts, 'attack') +
          getBaseActionEnergyCost(units.Hero?.energyCosts, 'heroPowerCharge')
        : null,
      blockEnergyPerSecond: canBlock
        ? (getBaseActionEnergyCost(units.Hero?.energyCosts, 'heroDefense') * 1000) / HERO_POWER_CHARGE_MS
        : null,
    }
    weapon.scenarios = levels.map(level => {
      const actor = { experience: { [weapon.category]: xp.getXpForLevel(level) } }
      const bonus = xp.getCombatXpBonus(actor, weapon.category)
      return {
        level,
        bonus,
        criticalChance: xp.getCriticalHitChance(actor, weapon.category),
        damages: armorValues.map(armor => {
          const damage = 10000 - getHitPointsWithDamage({}, { hitPoints: 10000, armor }, weapon.power, bonus)
          const chargedDamage = meleeCharge
            ? 10000 - getHitPointsWithDamage({}, { hitPoints: 10000, armor }, weapon.heroCombat.chargedPower, bonus)
            : null
          return {
            armor,
            damage,
            chargedDamage,
            chargedCritical: chargedDamage == null ? null : chargedDamage * xp.CRITICAL_HIT_MULTIPLIER,
            critical: damage * xp.CRITICAL_HIT_MULTIPLIER,
          }
        }),
      }
    })
  }
  const tools = []
  for (const type of ['Hero', 'Villager'])
    for (const level of levels)
      for (const tier of [0, 2, 3]) {
        const equippedTier = getWorkToolTier({
          inventory: { activeWeapons: { tool: `axe_${forge.FORGE_MATERIALS[tier]}` } },
        })
        const experience = Object.fromEntries(
          ['woodcutting', 'mining', 'building', 'farming'].map(c => [c, xp.getXpForLevel(level)])
        )
        const gather = work =>
          getWorkGatherAmount(
            units[type]?.gatherAmount,
            work,
            xp.getGatherXpBonus({ experience, work }) + equippedTier,
            true,
            equippedTier
          )
        tools.push({
          type,
          level,
          tier,
          material: materials[tier],
          wood: gather('woodcutter'),
          mining: gather('stoneminer'),
          gold: gather('goldminer'),
          wheat: gather('farmer'),
          handWheat: getWorkGatherAmount(units[type]?.gatherAmount, 'farmer', 0, false),
          buildMultiplier: (1 + equippedTier * 0.25) * xp.getBuildRateXpMultiplier({ experience }),
        })
      }
  return {
    whiffEnergy: getBaseActionEnergyCost(units.Hero?.energyCosts, 'heroWhiff'),
    weapons,
    armorItems,
    armorSets,
    armorValues,
    maxArmor,
    heroBaseArmor,
    tools,
    levels,
    swings: Object.fromEntries(
      ['wood', 'stone', 'copper', 'tin', 'iron', 'gold', 'wheat'].map(r => [r, getResourceGatherSwings(r)])
    ),
  }
}
function performanceSections(
  report,
  {
    escape,
    format,
    table,
    row,
    cost = value =>
      Object.entries(value)
        .map(([key, n]) => `${format(n)} ${escape(key)}`)
        .join(' · ') || '—',
  }
) {
  const data = report.performance
  if (!data) return ''
  const options = data.levels.map(l => `<option>${l}</option>`).join('')
  return `<section id="weapons"><h2>Armes et dégâts</h2><p>Comparaison à équipement intact et fixe, difficulté normale, coups de mêlée simples ou chargés du héros, projectile à pleine puissance, sans parade ni défense active. Le niveau est celui de la compétence de combat concernée, pas le niveau global. Les arcs incluent la flèche indiquée. Le lance-pierre consomme une pierre par tir et utilise la compétence à distance. Les outils attaquent au relâchement, peuvent charger et bloquer depuis l’emplacement Outil. Ces commandes concernent le héros.</p>
<div class="controls"><label for="combat-level">Niveau de combat</label><select id="combat-level">${options}</select><label for="target-armor">Armure effective de la cible</label><select id="target-armor">${data.armorValues.map(a => `<option>${a}</option>`).join('')}</select><label for="weapon-search">Rechercher une arme</label><input id="weapon-search" type="search" placeholder="Hache, cuivre, arc…"></div>
${table(
  [
    'Arme / combinaison',
    'Contacts / tirs avant casse',
    'Réparation à état zéro',
    'Séquence d’animation',
    'Puissance de base',
    'Bonus du niveau',
    'Dégâts / impact',
    'Dégâts chargés / impact',
    'Critique chargé',
    'Charge / énergie',
    'Blocage / énergie',
    'Coup critique simple',
    'Chance critique',
  ],
  data.weapons.map(
    w =>
      `<tr data-weapon="${escape(w.id)}"><td>${escape(w.label)}${w.tool ? ' · Outil équipé' : ''}<small>${escape(w.id)}</small></td><td>${w.maxUses == null ? '—' : format(w.maxUses)}</td><td>${cost(w.repairCost)}</td><td>${w.animationSequence ? `<code>${w.animationSequence.join('-')}</code><small>${w.animationSequence.length} images, répétitions incluses</small>` : 'Ordre natif de l’animation'}</td><td>${format(w.power)}</td><td data-stat="bonus"></td><td data-stat="damage"></td><td data-stat="chargedDamage"></td><td data-stat="chargedCritical"></td><td>${w.heroCombat.chargeMs == null ? 'Sans bonus de puissance de mêlée' : `${format(w.heroCombat.chargeMs)} ms · puissance ×${format(getHeroSwordChargeDamageMultiplier(1))}<small>${format(w.heroCombat.strikeEnergy)} énergie / coup simple ; ${format(w.heroCombat.chargedStrikeEnergy)} / coup chargé</small>`}</td><td>${w.heroCombat.canBlock ? `Oui<small>${format(w.heroCombat.blockEnergyPerSecond)} énergie / s</small>` : 'Non'}</td><td data-stat="critical"></td><td data-stat="chance"></td></tr>`
  )
)}
<p class="muted">Séquence configurée pour l’attaque : indices des images source, à partir de 0. Une image répétée compte plusieurs fois dans la lecture. « Ordre natif » signifie qu’aucune séquence personnalisée ne remplace l’animation. La charge, l’arrêt à l’impact et la récupération peuvent interrompre cette séquence : sa longueur ne donne donc pas à elle seule la cadence des coups.</p>
<p>Charge complète : ${HERO_POWER_CHARGE_MS} ms avant le déclenchement de l’attaque. La puissance est multipliée puis arrondie avant l’armure ; le bonus de compétence s’ajoute ensuite. Le coût chargé comprend ce maintien et un coup touchant sa cible. Maintenir plus longtemps continue de consommer de l’énergie sans augmenter la puissance. Un coup à vide coûte ${format(data.whiffEnergy)} énergie, hors charge. La garde bloque de face, pas de dos, et cesse à épuisement de l’énergie. Récolte et construction restent répétées au maintien.</p>
<p>Durabilité : armes de mêlée en pierre / bronze / fer, 300 / 600 / 900 contacts ; arcs, 600 tirs ; lance-pierre, 300 tirs. Un contact paré use l’arme de l’attaquant et l’arme ou l’outil du défenseur d’un usage chacun. Maintenir la garde sans impact ne coûte aucune durabilité. Le dernier usage bloque encore le coup, puis la casse interrompt la garde. Un coup dans le vide n’use pas l’arme. Chaque projectile lancé use l’arme, même sans toucher. Les réparations des armes demandent 50 % de leur recette multipliés par l’usure, arrondis par ingrédient. Les arcs sans recette propre utilisent celle de l’arc simple. Les flèches ne sont pas incluses dans la réparation. Les outils et armures conservent leurs coûts de réparation distincts.</p>
<p class="muted">Cadence et DPS : non mesurés. Les ${HERO_POWER_CHARGE_MS} ms de charge s’ajoutent à l’animation et à sa récupération ; ils ne représentent pas le délai total entre deux coups. Les armes à distance ne reçoivent pas le multiplicateur de puissance de mêlée.</p>
<details><summary>Protections des pièces et exemples d’équipement complet</summary><p>Le plafond caché de 3 est supprimé pour les unités ordinaires. Les pièces intactes s’additionnent ; une pièce cassée n’apporte plus de protection. Le héros ajoute ${format(data.heroBaseArmor)} point(s) d’armure de base. Le sélecteur couvre 0 à ${data.maxArmor}, maximum du catalogue actuel par emplacement, base du héros incluse.</p>
${table(
  [
    'Exemple complet : maille, casque pointu, épaulières, brassards, jambières, bouclier',
    'Armure équipement',
    'Armure du héros',
  ],
  data.armorSets.map(s => row([escape(s.material), format(s.armor), format(s.heroArmor)]))
)}
${table(
  ['Pièce', 'Emplacement', 'Protection brute'],
  data.armorItems.map(a => row([escape(a.label), escape(a.slot ?? 'Non équipable'), format(a.armor)]))
)}</details>
<p class="muted">L’armure réduit la puissance de base avec un minimum de 1 dégât (0,5 à mains nues), puis le bonus de compétence s’ajoute. Les critiques ne s’appliquent pas aux villageois. Les portées, charges, cadences, usures et situations réelles peuvent modifier le résultat : ce tableau n’est pas un calcul de dégâts par seconde.</p></section>
<section id="tools"><h2>Outils et rendement</h2><p>Comparaison du matériau de l’outil réellement équipé : hache pour le bois, pioche pour les minerais, marteau pour la construction, faux pour les cultures. Un seul emplacement Outil ; changer d’activité exige le bon outil. Le blé peut être récolté à la main sans faux, même si elle est rangée ou cassée : 1 blé par lot, sans bonus de compétence ni de matériau. Les autres travaux nécessitant un outil restent bloqués sans celui-ci. Les découvertes de métaux ne remplacent pas cet équipement.</p>
<div class="controls"><label for="work-level">Niveau de la compétence de travail</label><select id="work-level">${options}</select><label for="worker-type">Travailleur</label><select id="worker-type"><option value="Hero">Héros</option><option value="Villager">Villageois</option></select></div>
${table(
  [
    'Matériau équipé',
    'Bois / lot',
    'Pierre, cuivre, étain, fer / lot',
    'Or / lot',
    'Blé avec faux / lot',
    'Blé à la main / lot',
    'Travail de construction / impact',
  ],
  [0, 2, 3].map(
    t => `<tr data-tool="${t}">${[materials[t], '', '', '', '', '', ''].map(c => `<td>${c}</td>`).join('')}</tr>`
  )
)}
<p>Un lot de bois est libéré tous les ${data.swings.wood} coups après abattage ; pierre/cuivre/étain : ${data.swings.stone}/${data.swings.copper}/${data.swings.tin} coups ; fer : ${data.swings.iron} ; or : ${data.swings.gold}. Blé : ${data.swings.wheat} coup(s) par lot, à la main comme avec une faux. Quantités plafonnées par le stock restant et la capacité de transport. Le fer exige une pioche de bronze ou mieux.</p>
<div class="finding"><p>L’abattage retire actuellement 1 PV à l’arbre par impact, quelle que soit la puissance de combat de la hache. Une meilleure hache améliore le lot récolté via son propre matériau, sans accélérer cette phase d’abattage.</p></div><p class="muted">Les villageois ne gagnent actuellement pas d’XP : les niveaux supérieurs illustrent uniquement une compétence déjà présente dans leurs données. Les bonus des différentes compétences sont comparés au même niveau, indépendamment. Aucun débit par minute n’est déduit : animations, fatigue et trajets restent à mesurer.</p></section>
<script>(() => {
const data = ${JSON.stringify(data).replace(/</g, '\\u003c')};
const number = n => new Intl.NumberFormat('fr-FR', {maximumFractionDigits: 3}).format(n);
function combat() {
 const level = Number(document.getElementById('combat-level').value), armor = Number(document.getElementById('target-armor').value), query = document.getElementById('weapon-search').value.toLocaleLowerCase('fr');
 for (const tr of document.querySelectorAll('[data-weapon]')) {
  const weapon = data.weapons.find(w => w.id === tr.dataset.weapon), scenario = weapon.scenarios.find(s => s.level === level), hit = scenario.damages.find(d => d.armor === armor);
  tr.hidden = !(weapon.label + ' ' + weapon.id).toLocaleLowerCase('fr').includes(query);
  for (const [key, value] of Object.entries({bonus: scenario.bonus, damage: hit.damage, critical: hit.critical, chargedDamage: hit.chargedDamage, chargedCritical: hit.chargedCritical, chance: scenario.criticalChance * 100})) tr.querySelector('[data-stat="' + key + '"]').textContent = value == null ? '—' : number(value) + (key === 'chance' ? ' %' : '');
 }
}
function work() {
 const level = Number(document.getElementById('work-level').value), type = document.getElementById('worker-type').value;
 for (const tr of document.querySelectorAll('[data-tool]')) {
  const tool = data.tools.find(t => t.type === type && t.level === level && t.tier === Number(tr.dataset.tool));
  [tool.wood, tool.mining, tool.gold, tool.wheat, tool.handWheat, tool.buildMultiplier].forEach((v,i) => tr.children[i+1].textContent = number(v));
 }
}
for (const id of ['combat-level', 'target-armor', 'weapon-search']) document.getElementById(id).addEventListener('input', combat);
for (const id of ['work-level', 'worker-type']) document.getElementById(id).addEventListener('input', work);
combat(); work();
})();</script>`
}
module.exports = { performanceCatalogue, performanceSections }
