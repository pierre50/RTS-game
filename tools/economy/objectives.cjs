// Pure scenario calculator, also embedded verbatim in the standalone report.
function estimateObjective(data, input) {
  const objective = data.objectives.find(o => o.id === input.objective)
  if (!objective) throw new Error('Objectif inconnu.')
  const positive = ['workers', 'capacity', 'speed', 'impactSeconds']
  const nonnegative = ['distance', 'pausePercent', 'woodOverhead', 'craftSeconds', 'stationTravelSeconds']
  for (const key of [...positive, ...nonnegative])
    if (!Number.isFinite(input[key]) || input[key] < 0 || (positive.includes(key) && input[key] === 0))
      throw new Error(`Hypothèse invalide : ${key}`)
  if (!Number.isInteger(input.workers) || !Number.isInteger(input.capacity) || input.pausePercent >= 100)
    throw new Error('Travailleurs et capacité : entiers positifs ; pauses : moins de 100 %.')
  const stock = { ...input.stock },
    used = {},
    missing = {},
    steps = []
  for (const value of Object.values(stock)) if (!Number.isFinite(value) || value < 0) throw new Error('Stock invalide.')
  const consume = (resource, quantity, visiting = new Set()) => {
    const take = Math.min(quantity, stock[resource] ?? 0)
    stock[resource] = (stock[resource] ?? 0) - take
    used[resource] = (used[resource] ?? 0) + take
    const remainder = quantity - take
    if (remainder <= 0) return
    const recipe = data.recipes.find(r => r.outputResource === resource)
    if (!recipe) {
      missing[resource] = (missing[resource] ?? 0) + remainder
      return
    }
    if (visiting.has(resource)) throw new Error('Cycle de recettes.')
    const batches = Math.ceil(remainder / recipe.outputCount)
    for (const [key, count] of Object.entries(recipe.cost))
      consume(key, count * batches, new Set([...visiting, resource]))
    stock[resource] += batches * recipe.outputCount - remainder
    steps.push({ label: recipe.id, batches })
  }
  const goalOwned = objective.resource && (stock[objective.resource] ?? 0) >= 1
  let work = goalOwned ? 0 : objective.work
  const needsForge = objective.forge && !goalOwned
  if (needsForge && !input.forgeReady) {
    for (const [key, count] of Object.entries(data.forge.cost)) consume(key, count)
    work += data.forge.constructionWork
  }
  if (!goalOwned) {
    for (const [key, count] of Object.entries(objective.cost)) consume(key, count)
    if (objective.recipe) steps.push({ label: objective.recipe, batches: 1 })
  }
  const tool = data.performance.tools.find(t => t.type === 'Hero' && t.level === input.level && t.tier === input.tier)
  if (!tool) throw new Error('Niveau ou palier invalide.')
  const resources = Object.entries(missing).map(([resource, quantity]) => {
    const gain = resource === 'wood' ? tool.wood : resource === 'gold' ? tool.gold : tool.mining
    const swings = data.performance.swings[resource]
    if (!swings) throw new Error(`Rendement non modélisé : ${resource}`)
    const lots = Math.ceil(quantity / Math.min(input.capacity, gain))
    const trips = Math.ceil(quantity / input.capacity)
    const harvest = lots * swings * input.impactSeconds + (resource === 'wood' ? quantity * input.woodOverhead : 0)
    const travel = (trips * 2 * input.distance) / input.speed
    return { resource, quantity, lots, trips, harvest: harvest / input.workers, travel: travel / input.workers }
  })
  const harvest = resources.reduce((n, r) => n + r.harvest, 0)
  const travel = resources.reduce((n, r) => n + r.travel, 0) + (needsForge ? input.stationTravelSeconds : 0)
  const build = ((work / tool.buildMultiplier) * input.impactSeconds) / input.workers
  const craft = steps.reduce((n, s) => n + s.batches, 0) * input.craftSeconds
  const active = harvest + travel + build + craft
  const pause = (active * input.pausePercent) / (100 - input.pausePercent)
  const phases = { harvest, travel, build, craft, pause }
  const blockers = []
  if (needsForge && !input.forgeReady)
    blockers.push('Forge absente : matériaux et construction ajoutés ; son emplacement doit être accessible.')
  if (resources.length)
    blockers.push('Stocks insuffisants : récolter les ressources indiquées, sur des gisements accessibles.')
  if (missing.iron && input.tier < 2)
    blockers.push(
      'Fer inaccessible avec le matériau de pioche sélectionné : une pioche de bronze ou de fer doit être équipée.'
    )
  const missingOnMap = resources
    .filter(r => data.mapStock && (data.mapStock[r.resource] ?? 0) < r.quantity)
    .map(r => r.resource)
  for (const resource of missingOnMap) {
    if (data.caveStock?.[resource] > 0)
      blockers.push(
        `Source identifiée : ${data.caveStock[resource]} unité(s) de ${resource} dans les plans des grottes placées. Extraction réservée au héros ; expédition et combats non compris dans cette durée.`
      )
    blockers.push(
      `Stock initial de surface insuffisant sur cette carte : ${{ wood: 'bois', stone: 'pierre', copper: 'cuivre', tin: 'étain', iron: 'fer' }[resource] ?? resource}. La durée suppose une autre source disponible ; le temps pour y accéder n’est pas évalué ici.`
    )
  }
  const bottleneck = Object.entries(phases).sort((a, b) => b[1] - a[1])[0]
  // Only crafting and equipping a better axe improves the next wood harvest.
  const nextTier = Math.max(input.tier, objective.equippedAxeTier ?? input.tier)
  const improved = data.performance.tools.find(t => t.type === 'Hero' && t.level === input.level && t.tier === nextTier)
  const nextWood = gain =>
    (Math.ceil(100 / Math.min(input.capacity, gain)) * data.performance.swings.wood * input.impactSeconds +
      100 * input.woodOverhead +
      (Math.ceil(100 / input.capacity) * 2 * input.distance) / input.speed) /
    input.workers /
    (1 - input.pausePercent / 100)
  return {
    objective: objective.id,
    used,
    missing,
    surplus: stock,
    steps,
    resources,
    phases,
    total: active + pause,
    blockers,
    bottleneck: bottleneck[1] > 0 ? bottleneck[0] : null,
    nextWoodBefore: nextWood(tool.wood),
    nextWoodAfter: nextWood(improved.wood),
    goalOwned,
    missingOnMap,
  }
}
function objectiveCatalogue(buildings, recipes, performance, map, supply) {
  const house = buildings.find(b => b.type === 'House' && b.level === 0)
  const forge = buildings.find(b => b.type === 'Forge' && b.level === 0)
  const axe = recipes.find(r => r.id === 'axe_bronze')
  const bronze = recipes.find(r => r.outputResource === 'bronzeIngot')
  if (!house || !forge || !axe || !bronze) return null
  return {
    objectives: [
      {
        id: 'maison',
        label: 'Construire une maison (niveau initial)',
        cost: house.cost,
        work: house.constructionWork,
        forge: false,
      },
      {
        id: 'hache-bronze',
        label: 'Fabriquer une hache en bronze',
        cost: axe.cost,
        recipe: axe.id,
        work: 0,
        forge: true,
        equippedAxeTier: 2,
      },
      {
        id: 'bronze',
        label: 'Découvrir le bronze (posséder un lingot)',
        resource: 'bronzeIngot',
        cost: { bronzeIngot: 1 },
        work: 0,
        forge: true,
      },
    ],
    forge,
    caveStock: supply
      ? supply.caves.reduce((sum, cave) => {
          for (const [k, v] of Object.entries(cave.quantities)) sum[k.toLowerCase()] = (sum[k.toLowerCase()] ?? 0) + v
          return sum
        }, {})
      : {},
    mapStock: map ? Object.fromEntries(map.resources.map(r => [r.resource, r.quantity])) : null,
    recipes: recipes.filter(r => r.outputResource),
    performance: { tools: performance.tools, swings: performance.swings },
  }
}
function objectiveSection(report, { escape }) {
  const data = report.objectives
  if (!data) return ''
  const field = (id, label, value, min = 0, step = 'any', max = '') =>
    `<label>${label}<input id="goal-${id}" type="number" value="${value}" min="${min}" step="${step}" ${max ? `max="${max}"` : ''}></label>`
  return `<section id="objectives"><h2>Temps pour atteindre un objectif</h2><p>Estimation de scénario, pas une partie simulée. Réglez les hypothèses puis comparez avec un objectif chronométré dans « Bilan joué ». Les durées ci-dessous sont des secondes selon vos hypothèses, sans conversion automatique en jours de jeu.</p>
<div class="controls"><label>Objectif<select id="goal-objective">${data.objectives.map(o => `<option value="${escape(o.id)}">${escape(o.label)}</option>`).join('')}</select></label><label><input id="goal-forge" type="checkbox" checked style="width:auto"> Forge achevée et accessible</label></div>
<details><summary>Conditions de départ et hypothèses modifiables</summary><p class="muted">Valeurs initiales illustratives, à remplacer par vos mesures. Travailleurs identiques, même compétence et matériau d’outil équipé ; travail réparti idéalement. Phases successives, pas de concurrence entre objectifs. Les outils nécessaires sont supposés déjà équipés au bon moment. Leur matériau reste fixe pendant le calcul. Les coûts de remplacement, la casse et les changements d’outil ne sont pas inclus : cette estimation peut être trop optimiste.</p><div class="controls">
${field('workers', 'Travailleurs', 1, 1, 1)}${field('level', 'Niveau de compétence', 1, 1, 1, 20)}${field('tier', 'Outils équipés : 0 pierre, 1 cuivre, 2 bronze, 3 fer', 0, 0, 1, 3)}${field('capacity', 'Capacité transportée / voyage', 10, 1, 1)}${field('distance', 'Distance aller au gisement (cases)', 20)}${field('speed', 'Vitesse (cases / seconde)', 2, 0.01)}${field('impactSeconds', 'Secondes / impact de travail', 1, 0.01)}${field('woodOverhead', 'Abattage : secondes supplémentaires / bois', 1)}${field('pausePercent', 'Part du temps en pauses (%)', 20, 0, 1, 99)}${field('craftSeconds', 'Manipulation / lot de craft (secondes)', 0)}${field('stationTravelSeconds', 'Trajet supplémentaire vers la forge (secondes)', 0)}
</div><p class="muted">Les recettes manuelles n’ont pas de minuterie configurée : leur temps de manipulation est saisi séparément. La distance est une longueur de trajet supposée, pas une distance calculée sur la carte. Les voyages incluent l’aller-retour ; les matériaux déjà en stock sont supposés sur place. Repas, usure, obstacles et recherche de gisements ne sont pas chiffrés.</p>
<h3>Stocks disponibles sur place</h3><div class="controls">${['wood', 'stone', 'copper', 'tin', 'bronzeIngot'].map(k => field('stock-' + k, { wood: 'Bois', stone: 'Pierre', copper: 'Cuivre', tin: 'Étain', copperIngot: 'Lingots de cuivre', bronzeIngot: 'Lingots de bronze' }[k], 0)).join('')}</div></details>
<p id="goal-error" role="alert"></p><div id="goal-result" aria-live="polite"></div>
<p class="muted">Le débit d’une équipe est une approximation idéale : doubler les travailleurs ne garantit pas un temps divisé par deux en jeu. La disponibilité du terrain, des bâtiments et des outils doit être vérifiée dans la partie. Le stock de départ n’est jamais déduit automatiquement des ressources de toute la carte.</p></section>
<script>
${estimateObjective.toString()}
(() => {
 const data = ${JSON.stringify(data).replace(/</g, '\\u003c')};
 const labels = {wood:'Bois',stone:'Pierre',copper:'Cuivre',tin:'Étain',copperIngot:'Lingots de cuivre',bronzeIngot:'Lingots de bronze',harvest:'Récolte et abattage',travel:'Trajets',build:'Construction',craft:'Fabrication / manipulation',pause:'Pauses'};
 const n = v => new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(v);
 const duration = s => n(s / 60) + ' min (' + n(s) + ' s)';
 const target = document.getElementById('goal-result');
 const text = (tag,value) => { const e=document.createElement(tag);e.textContent=value;return e; };
 function table(headers, rows) {const wrap=document.createElement('div');wrap.className='table-wrap';const t=document.createElement('table'),head=document.createElement('thead'),body=document.createElement('tbody'),tr=document.createElement('tr');headers.forEach(h=>tr.append(text('th',h)));head.append(tr);rows.forEach(r=>{const tr=document.createElement('tr');r.forEach(c=>tr.append(text('td',c)));body.append(tr);});t.append(head,body);wrap.append(t);target.append(wrap);}
 function render() {
  target.replaceChildren();document.getElementById('goal-error').textContent='';
  try {
   const input = {objective:document.getElementById('goal-objective').value,forgeReady:document.getElementById('goal-forge').checked,stock:{}};
   for(const key of ['workers','level','tier','capacity','distance','speed','impactSeconds','woodOverhead','pausePercent','craftSeconds','stationTravelSeconds']) {const e=document.getElementById('goal-'+key); if(!e.checkValidity() || e.value==='')throw new Error('Vérifiez les hypothèses chiffrées.');input[key]=Number(e.value);}
   for(const key of ['wood','stone','copper','tin','bronzeIngot']) {const e=document.getElementById('goal-stock-'+key);if(e.value==='')throw new Error('Renseignez les stocks.');input.stock[key]=Number(e.value);}
   const result=estimateObjective(data,input);
   target.append(text('h3',(result.missingOnMap.length ? 'Durée conditionnelle (approvisionnement hors surface) : ' : 'Durée estimée : ')+duration(result.total)));
   if(result.goalOwned)target.append(text('p','Lingot déjà présent : la condition de découverte est satisfaite dès le départ.'));
   table(['Étape','Durée estimée'],Object.entries(result.phases).map(([k,v])=>[labels[k],duration(v)]));
   target.append(text('p',result.bottleneck ? 'Poste le plus long : '+labels[result.bottleneck]+'.' : 'Aucun temps supplémentaire dans ce scénario.'));
   for(const warning of result.blockers)target.append(text('p',warning));
   target.append(text('h3','Ressources de départ utilisées et récolte restante'));
   table(['Ressource','Stock utilisé','À récolter'],[...new Set([...Object.keys(result.used),...Object.keys(result.missing)])].map(k=>[labels[k]||k,n(result.used[k]||0),n(result.missing[k]||0)]));
   table(['Ressource à récolter','Lots','Voyages','Récolte','Transport'],result.resources.map(r=>[labels[r.resource]||r.resource,n(r.lots),n(r.trips),duration(r.harvest),duration(r.travel)]));
   target.append(text('h3','Fabrications intermédiaires et résultat'));
   target.append(text('p',result.steps.length ? result.steps.map(s=>(labels[s.label]||s.label)+' × '+s.batches+' lot(s)').join(' → ') : 'Aucun craft requis.'));
   target.append(text('h3','Gain sur les 100 prochains bois'));
   target.append(text('p',duration(result.nextWoodBefore)+' avant ; '+duration(result.nextWoodAfter)+' après. Économie estimée : '+duration(result.nextWoodBefore-result.nextWoodAfter)+'. Le gain suppose que la hache fabriquée est ensuite équipée. Découvrir un métal seul ne modifie pas le rendement. Les trajets et l’abattage restent inchangés.'));
  }catch(e){document.getElementById('goal-error').textContent=e.message;}
 }
 document.getElementById('objectives').addEventListener('input',render);render();
})();</script>`
}
module.exports = { estimateObjective, objectiveCatalogue, objectiveSection }
