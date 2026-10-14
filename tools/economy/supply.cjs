const { loadGenerationTs: load } = require('../maps/load-generation-ts.cjs')
const {
  getMarketEquipmentOffers,
  getMarketDailyGold,
  getEquipmentResaleGoldValue,
  getResourceGoldValue,
  getMarketResourceOffers,
  MARKET_RESTOCK_INTERVAL_DAYS,
} = load('app/lib/equipment/equipmentMarket.ts')
const { MARKET_GOLD_TARGETS, MARKET_RESOURCE_BUY_MULTIPLIER, EQUIPMENT_RESALE_PERCENT } = load('app/config/market.ts')
const { CIVILIZATIONS } = load('app/config/civilizations.ts')
const { EQUIPMENT_NAMES } = load('app/lib/i18n/equipmentNames.ts')
// Reads declared physical inventories only; legacy player totals are often mirrors, never extra stock.
function stockInventory(players, origin = 'Données préparées', world = '') {
  if (!Array.isArray(players)) throw new Error('Liste de joueurs invalide.')
  const rows = [],
    markets = [],
    caves = []
  const amount = n => typeof n === 'number' && Number.isFinite(n) && n >= 0
  for (const player of players) {
    const seen = new Set(),
      labels = new Set()
    function visit(entity, location = '') {
      if (!entity || typeof entity !== 'object' || seen.has(entity)) return
      if (entity.label && labels.has(entity.label)) return
      seen.add(entity)
      if (entity.label) labels.add(entity.label)
      const where = entity.label ?? `${entity.type ?? 'Inventaire'} ${entity.i ?? '?'},${entity.j ?? '?'}`
      const base = {
        origin,
        world,
        owner: player.label ?? player.civ ?? 'Inconnu',
        type: entity.type ?? 'Inventaire',
        location: location || where,
        holder: where,
        i: entity.i ?? null,
        j: entity.j ?? null,
        accessible: !entity.isDead && !entity.isDestroyed,
      }
      for (const [resource, quantity] of Object.entries(entity.inventory?.resources ?? {})) {
        if (!amount(quantity)) throw new Error(`Quantité invalide : ${where} / ${resource}`)
        if (resource === 'food' && ['berry', 'meat', 'wheat'].some(k => Object.hasOwn(entity.inventory.resources, k)))
          continue
        if (quantity) rows.push({ ...base, resource, quantity })
      }
      if (entity.type === 'Market') {
        if (entity.marketGold != null && !amount(entity.marketGold)) throw new Error('Trésorerie de marché invalide.')
        const stock = {}
        for (const item of entity.marketStock ?? []) {
          if (typeof item !== 'string') throw new Error('Stock marchand invalide.')
          stock[item] = (stock[item] ?? 0) + 1
        }
        markets.push({ ...base, gold: entity.marketGold ?? null, stock: entity.marketStock ? stock : null })
      }
      if (entity.cave?.minerals)
        for (const node of entity.cave.minerals) {
          if (!amount(node.quantity)) throw new Error('Stock minier sauvegardé invalide.')
          caves.push({ ...base, resource: node.type, quantity: node.quantity, nodeI: node.i, nodeJ: node.j })
        }
      for (const child of entity.interiorBuildings ?? []) visit(child, where)
    }
    for (const entity of [...(player.units ?? []), ...(player.buildings ?? []), ...(player.corpses ?? [])])
      visit(entity)
  }
  return { rows, markets, caves }
}
function readSaveStocks(save) {
  if (save?.format === 'campaign-v1') {
    if (!save.worlds || typeof save.worlds !== 'object') throw new Error('Mondes de campagne absents.')
    const combined = { rows: [], markets: [], caves: [] }
    for (const [world, value] of Object.entries(save.worlds)) {
      if (!value?.state) continue
      const result = stockInventory(value.state.players, 'Sauvegarde', world)
      for (const key of Object.keys(combined)) combined[key].push(...result[key])
    }
    return combined
  }
  if (!save || !Array.isArray(save.players)) throw new Error('Sauvegarde de partie ou campagne attendue.')
  return stockInventory(
    save.players,
    'Sauvegarde',
    save.world?.worldRegionId ?? save.world?.mapId ?? 'Monde non précisé'
  )
}
function supplyCatalogue(map, prepared, catalog, saveStocks) {
  const caves = (map.caves ?? []).map(cave => {
    const blueprintId = cave.blueprintId ?? 'cave-small-circle'
    const blueprint = catalog.blueprints.find(b => b.id === blueprintId)
    const quantities = {}
    for (const node of blueprint?.resources ?? [])
      if (['Gold', 'Copper', 'Tin', 'Iron'].includes(node.type))
        quantities[node.type] = (quantities[node.type] ?? 0) + node.quantity
    return { id: cave.id, blueprintId, tier: cave.tier, i: cave.i, j: cave.j, known: !!blueprint, quantities }
  })
  return {
    caves,
    prepared: stockInventory(prepared?.players ?? []),
    saved: saveStocks ?? null,
    market: {
      restockDays: MARKET_RESTOCK_INTERVAL_DAYS,
      resourceBuyMultiplier: MARKET_RESOURCE_BUY_MULTIPLIER,
      equipmentResalePercent: EQUIPMENT_RESALE_PERCENT,
      levels: MARKET_GOLD_TARGETS.map((gold, buildingLevel) => ({
        level: buildingLevel + 1,
        gold,
        dailyGold: getMarketDailyGold({ buildingLevel }),
      })),
      resources: Array.from(MARKET_GOLD_TARGETS.keys()).flatMap(buildingLevel =>
        getMarketResourceOffers({ buildingLevel }).map(offer => ({ ...offer, level: buildingLevel + 1 }))
      ),
      offers: CIVILIZATIONS.flatMap(c =>
        Array.from(MARKET_GOLD_TARGETS.keys()).flatMap(buildingLevel =>
          getMarketEquipmentOffers({ civilization: c.value, buildingLevel }).map(o => ({
            level: buildingLevel + 1,
            ...o,
            civilization: c.value,
            label: EQUIPMENT_NAMES[o.equipment]?.fr ?? o.equipment,
            resale: getEquipmentResaleGoldValue(o.equipment),
          }))
        )
      ),
      resourceResale: Object.fromEntries(
        [
          'wood',
          'stone',
          'copper',
          'tin',
          'iron',
          'copperIngot',
          'bronzeIngot',
          'ironIngot',
          'berry',
          'meat',
          'wheat',
        ].map(r => [r, getResourceGoldValue(r)])
      ),
    },
  }
}
function renderStocks(data, target) {
  target.replaceChildren()
  const resourceName = key =>
    ({
      wood: 'Bois',
      stone: 'Pierre',
      gold: 'Or',
      copper: 'Cuivre',
      tin: 'Étain',
      iron: 'Fer',
      berry: 'Baies',
      meat: 'Viande',
      wheat: 'Blé',
      fiber: 'Fibre',
      copperIngot: 'Lingot de cuivre',
      bronzeIngot: 'Lingot de bronze',
      ironIngot: 'Lingot de fer',
    })[key] ??
    { Tin: 'Étain', Gold: 'Or', Copper: 'Cuivre', Iron: 'Fer' }[key] ??
    key
  const n = value => new Intl.NumberFormat('fr-FR').format(value)
  const text = (tag, value) => {
    const e = document.createElement(tag)
    e.textContent = value
    return e
  }
  function table(headers, rows) {
    const wrap = document.createElement('div')
    wrap.className = 'table-wrap'
    const t = document.createElement('table'),
      head = document.createElement('thead'),
      body = document.createElement('tbody'),
      heading = document.createElement('tr')
    headers.forEach(h => heading.append(text('th', h)))
    head.append(heading)
    rows.forEach(values => {
      const row = document.createElement('tr')
      values.forEach(v => row.append(text('td', v)))
      body.append(row)
    })
    t.append(head, body)
    wrap.append(t)
    target.append(wrap)
  }
  if (!data) {
    target.append(text('p', 'Aucune sauvegarde importée. Aucun stock actuel n’est supposé.'))
    return
  }
  const filterLabel = text('label', 'Filtrer ces stocks : ')
  const filter = document.createElement('input')
  filter.type = 'search'
  filter.placeholder = 'Joueur, ressource, conteneur…'
  filterLabel.append(filter)
  target.append(filterLabel)
  filter.addEventListener('input', () => {
    const query = filter.value.toLocaleLowerCase('fr')
    for (const row of target.querySelectorAll('tbody tr'))
      row.hidden = !row.textContent.toLocaleLowerCase('fr').includes(query)
  })
  table(
    ['Monde', 'Propriétaire', 'Conteneur / unité', 'Emplacement', 'Ressource', 'Quantité', 'État'],
    data.rows.map(r => [
      r.world || 'Carte auditée',
      r.owner,
      r.holder,
      r.location + ' (' + r.i + ', ' + r.j + ')',
      resourceName(r.resource),
      n(r.quantity),
      r.accessible ? 'Vivant / non détruit' : 'Butin / détruit',
    ])
  )
  target.append(text('h3', 'Marchés déclarés dans ces données'))
  table(
    ['Propriétaire', 'Marché', 'Trésorerie', 'Stock marchand déclaré'],
    data.markets.map(m => [
      m.owner,
      m.holder,
      m.gold == null ? 'Non enregistré' : n(m.gold),
      m.stock == null
        ? 'Non initialisé / inconnu'
        : Object.entries(m.stock)
            .map(([k, v]) => k + ' × ' + v)
            .join(', ') || 'Vide',
    ])
  )
  target.append(text('h3', 'Minerais restants dans les grottes déjà enregistrées'))
  table(
    ['Monde', 'Grotte', 'Minerai', 'Quantité restante'],
    data.caves.map(c => [c.world || 'Carte auditée', c.holder, resourceName(c.resource), n(c.quantity)])
  )
}
function supplySection(report, { escape, format, cost, table, row }) {
  const data = report.supply
  if (!data) return ''
  return `<section id="supply"><h2>Autres sources d’approvisionnement</h2><h3>Grottes réellement placées · ${data.caves.length}</h3><p>Potentiel initial obtenu en reliant chaque entrée de cette carte à son plan intérieur. Ces quantités sont séparées des ressources de surface. Seul le héros peut miner dans une grotte ; les stocks y sont finis, sans repousse. Les ennemis et le trajet jusqu’à l’entrée restent à évaluer.</p><p><strong>Potentiel cumulé des grottes connues :</strong> ${cost(
    data.caves.reduce((total, cave) => {
      for (const [key, value] of Object.entries(cave.quantities))
        total[key.toLowerCase()] = (total[key.toLowerCase()] ?? 0) + value
      return total
    }, {})
  )}</p>
${table(
  ['Grotte', 'Plan', 'Coordonnées', 'Potentiel initial'],
  data.caves.map(c =>
    row([
      escape(c.id),
      escape(c.blueprintId),
      `${c.i}, ${c.j}`,
      c.known
        ? cost(Object.fromEntries(Object.entries(c.quantities).map(([k, v]) => [k.toLowerCase(), v])))
        : 'Plan absent : inconnu',
    ])
  )
)}
<h3>Commerce : offres configurées</h3><p>Catalogue par niveau et civilisation, pas un stock garanti dans chaque marché. Renouvellement des équipements tous les ${data.market.restockDays} jours selon les règles du jeu. Les ressources achetables sont listées séparément. Achat des ressources à ${data.market.resourceBuyMultiplier} fois leur valeur de revente ; équipement revendu à ${data.market.equipmentResalePercent} % de sa valeur selon son état. Le renouvellement d’or est partagé par village et dépend du meilleur marché.</p>
${table(
  ['Niveau', 'Réserve cible (or)', 'Budget quotidien du village (or)'],
  data.market.levels.map(level => row([level.level, format(level.gold), format(level.dailyGold)]))
)}
${table(
  ['Niveau', 'Ressource achetable', 'Stock', 'Prix / unité'],
  data.market.resources.map(offer =>
    row([offer.level, cost({ [offer.resource]: 1 }), format(offer.count), format(offer.goldValue)])
  )
)}
<details><summary>Équipements achetables, prix et lots de réapprovisionnement</summary>${table(
    ['Niveau', 'Civilisation', 'Équipement', 'Achat (or)', 'Revente (or)', 'Quantité au réapprovisionnement'],
    data.market.offers.map(o =>
      row([
        format(o.level),
        escape(o.civilization),
        escape(o.label),
        format(o.goldValue),
        format(o.resale),
        format(o.count),
      ])
    )
  )}</details>
${table(
  ['Ressource vendue par le joueur', 'Or reçu / unité'],
  Object.entries(data.market.resourceResale).map(([k, v]) => row([cost({ [k]: 1 }), format(v)]))
)}
<h3>Stocks locaux déclarés à la préparation</h3><p>Conteneurs et unités des données préparées, toutes factions incluses. Ces stocks ne vous appartiennent pas nécessairement et ne sont pas additionnés au potentiel des gisements. Les totaux miroirs du joueur sont exclus. Un inventaire absent n’est pas une preuve de stock nul après le démarrage.</p><div id="prepared-stocks"></div>
<h3>Stocks d’une sauvegarde réelle</h3><p>Importer un export JSON de partie ou de campagne, ou utiliser <code>--save fichier.json</code>. Lecture locale sans modifier la sauvegarde. Les mondes enregistrés sont listés séparément ; les régions abstraites non visitées ne sont pas incluses. La date et l’accessibilité des stocks dépendent de la sauvegarde.</p><label for="supply-save">Importer une sauvegarde JSON</label><input id="supply-save" type="file" accept=".json,application/json"><p id="supply-error" role="alert"></p><div id="saved-stocks"></div></section>
<script>
${stockInventory.toString()}
${readSaveStocks.toString()}
${renderStocks.toString()}
renderStocks(${JSON.stringify(data.prepared).replace(/</g, '\\u003c')},document.getElementById('prepared-stocks'));
renderStocks(${JSON.stringify(data.saved).replace(/</g, '\\u003c')},document.getElementById('saved-stocks'));
document.getElementById('supply-save').addEventListener('change',async e=>{document.getElementById('supply-error').textContent='';try{const file=e.target.files[0];if(!file)return;if(file.size>100000000)throw new Error('Sauvegarde trop volumineuse (100 Mo maximum).');renderStocks(readSaveStocks(JSON.parse(await file.text())),document.getElementById('saved-stocks'));}catch(error){document.getElementById('supply-error').textContent=error.message;}});
</script>`
}
module.exports = { stockInventory, readSaveStocks, supplyCatalogue, supplySection }
