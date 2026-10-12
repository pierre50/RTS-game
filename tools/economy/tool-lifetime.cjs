const { loadGenerationTs: load } = require('../maps/load-generation-ts.cjs')
const { getEquipmentMaxUses } = load('app/lib/equipment/equipmentCondition.ts')
const { getWorkCycleMs } = load('app/lib/economy/workTiming.ts')
const { getResourceGatherSwings } = load('app/lib/economy/workRules.ts')

// Fresh identical nodes; partial final lots never create resources beyond the node's stock.
function harvestForImpacts(impacts, gain, swings, stock, felling = 0) {
  if (!(stock > 0) || !(gain > 0)) return 0
  const nodeImpacts = felling + Math.ceil(stock / gain) * swings
  const nodes = Math.floor(impacts / nodeImpacts)
  const remainder = Math.max(0, impacts - nodes * nodeImpacts - felling)
  return nodes * stock + Math.min(stock, Math.floor(remainder / swings) * gain)
}
function impactsForAmount(amount, gain, swings, stock, felling = 0) {
  if (amount <= 0) return 0
  const full = Math.floor(amount / stock)
  const tail = amount % stock
  return (
    full * (felling + Math.ceil(stock / gain) * swings) + (tail > 0 ? felling + Math.ceil(tail / gain) * swings : 0)
  )
}
function toolLifetimeCatalogue(units, resources, buildings, crafts, performance) {
  const scenarios = []
  for (const tool of performance.tools.filter(t => t.type === 'Villager' && t.level === 1)) {
    const material = ['ceramic', 'copper', 'bronze', 'iron'][tool.tier]
    const uses = getEquipmentMaxUses(`axe_${material}`)
    const jobs = [
      ['wood', 'Tree', 'axe', 'woodcutter', tool.wood, resources.Tree.totalHitPoints],
      ['stone', 'Stone', 'pickaxe', 'stoneminer', tool.mining, 0],
      ['copper', 'Copper', 'pickaxe', 'copperminer', tool.mining, 0],
      ['tin', 'Tin', 'pickaxe', 'tinminer', tool.mining, 0],
      ['iron', 'Iron', 'pickaxe', 'ironminer', tool.mining, 0],
      ['gold', 'Gold', 'pickaxe', 'goldminer', tool.gold, 0],
      ['wheat', 'Wheat', 'scythe', 'farmer', tool.wheat, 0],
    ]
    const harvests = jobs.map(([resource, type, family, work, gain, felling]) => {
      const action = { copperminer: 'minecopper', tinminer: 'minetin', ironminer: 'mineiron' }[work]
      const cycleMs = getWorkCycleMs(units.Villager, work, undefined, action)
      const stock = resources[type].totalQuantity
      const swings = getResourceGatherSwings(resource)
      return {
        resource,
        family,
        gain,
        stock,
        swings,
        felling,
        cycleMs,
        quantity: resource === 'iron' && tool.tier < 2 ? null : harvestForImpacts(uses, gain, swings, stock, felling),
        activeSeconds: (uses * cycleMs) / 1000,
      }
    })
    const equipment = ['axe', 'pickaxe', 'scythe', 'hammer'].map(family => {
      const recipe = crafts.find(c => c.outputEquipment === `${family}_${material}`)
      return { family, cost: recipe.cost, rawCost: recipe.rawCost }
    })
    const comparisons = Object.entries(buildings)
      .filter(
        ([, b]) =>
          b.constructionTime > 0 &&
          Object.keys(b.cost ?? {}).length > 0 &&
          Object.keys(b.cost).every(r => r === 'wood' || r === 'stone')
      )
      .map(([type, b]) => {
        const impacts = {
          axe: 0,
          pickaxe: 0,
          hammer: Math.ceil((b.constructionWorkRequired ?? b.constructionTime) / tool.buildMultiplier),
        }
        for (const [resource, amount] of Object.entries(b.cost)) {
          const h = harvests.find(h => h.resource === resource)
          impacts[h.family] += impactsForAmount(amount, h.gain, h.swings, h.stock, h.felling)
        }
        const counts = Object.fromEntries(Object.entries(impacts).map(([family, n]) => [family, Math.ceil(n / uses)]))
        const toolCost = {}
        for (const [family, count] of Object.entries(counts))
          for (const [resource, amount] of Object.entries(equipment.find(e => e.family === family).cost))
            if (count > 0) toolCost[resource] = (toolCost[resource] ?? 0) + count * amount
        return { type, cost: b.cost, impacts, counts, toolCost }
      })
    scenarios.push({
      material: tool.material,
      uses,
      harvests,
      equipment,
      comparisons,
      buildWork: uses * tool.buildMultiplier,
      hammerSeconds: (uses * getWorkCycleMs(units.Villager, 'builder')) / 1000,
    })
  }
  return { scenarios }
}
function toolLifetimeSection(report, { escape, format, table, row, cost, name }) {
  if (!report.toolLifetime) return ''
  const resourceNames = {
    wood: 'Bois, arbres debout',
    stone: 'Pierre',
    copper: 'Cuivre',
    tin: 'Étain',
    iron: 'Fer',
    gold: 'Or',
    wheat: 'Blé mûr',
  }
  const familyNames = { axe: 'Hache', pickaxe: 'Pioche', scythe: 'Faux', hammer: 'Marteau' }
  return `<section id="tool-lifetime"><h2>Durée de vie des outils et bâtiments</h2>
<p>Villageois niveau 1, outils neufs, sans gain de compétence. Pierre, bronze et fer ont respectivement ${report.toolLifetime.scenarios.map(s => s.uses).join(' / ')} coups disponibles. La durabilité des armes est détaillée dans « Armes et dégâts » ; les armures gardent leur usure actuelle.</p>
<p>Estimations de travail du modèle hors écran : récupération d’énergie théorique incluse, sans trajets, repas, repos ni temps de fabrication. Ce ne sont pas des chronométrages en direct. Gisements et arbres de taille configurée, disponibles en nombre suffisant ; chaque nouvel arbre doit être abattu. Les fins de gisement sont comptées ; les pertes de lots dues au sac et les interruptions sont exclues. Le blé suppose des plants mûrs disponibles, sans semis ni attente de repousse.</p>
${report.toolLifetime.scenarios
  .map(
    s => `<h3>${escape(s.material)} · ${s.uses} coups</h3>
${table(
  ['Ressource', 'Récolte avant casse', 'Travail estimé (min)'],
  s.harvests.map(h =>
    row([
      resourceNames[h.resource],
      h.quantity == null ? 'Outil insuffisant' : format(h.quantity),
      h.quantity == null ? '—' : format(h.activeSeconds / 60),
    ])
  )
)}
<p>Marteau : ${format(s.buildWork)} unités de construction, environ ${format(s.hammerSeconds / 60)} minutes de travail avant casse.</p>
${table(
  ['Outil', 'Coût de fabrication / remplacement', 'Équivalent matières premières'],
  s.equipment.map(e => row([familyNames[e.family], cost(e.cost), cost(e.rawCost)]))
)}
<details><summary>Outils nécessaires par bâtiment</summary><p>Chaque bâtiment est un scénario indépendant, sans stock initial, depuis des arbres debout. Les outils sont réutilisés jusqu’à leur casse, puis remplacés ; un arbre entamé reste entamé. Les comptes incluent le premier outil et arrondissent à des outils entiers. Le coût des outils est indiqué séparément : sa propre collecte et la construction d’une forge ne sont pas simulées. Les outils initiaux gratuits, réparations, ramassables et stocks existants ne sont pas déduits. Bâtiments de base demandant uniquement bois et/ou pierre.</p>
${table(
  ['Bâtiment', 'Matériaux', 'Haches', 'Pioches', 'Marteaux', 'Coût du jeu d’outils'],
  s.comparisons.map(b =>
    row([name(b.type), cost(b.cost), b.counts.axe, b.counts.pickaxe, b.counts.hammer, cost(b.toolCost)])
  )
)}
</details>`
  )
  .join('')}</section>`
}
module.exports = { toolLifetimeCatalogue, toolLifetimeSection, harvestForImpacts, impactsForAmount }
