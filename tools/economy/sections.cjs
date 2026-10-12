const { validateCapture } = require('./capture.cjs')
const { loadGenerationTs } = require('../maps/load-generation-ts.cjs')
const { DAY_NIGHT_CONFIG } = loadGenerationTs('app/config/gameplay.ts')

// Self-contained DOM renderer: shared by an imported file and the optional CLI capture.
function renderFlowCapture(capture, target, dayLengthMs) {
  target.replaceChildren()
  const text = (tag, value) => {
    const node = document.createElement(tag)
    node.textContent = value
    return node
  }
  const number = n => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n)
  if (!capture) {
    target.append(text('p', 'Aucune période mesurée importée. Les chiffres apparaîtront après une capture en jeu.'))
    return
  }
  target.append(
    text(
      'p',
      `${capture.active ? 'Capture encore active' : 'Capture arrêtée'} · ${number(capture.elapsedMs / dayLengthMs)} jours de jeu écoulés · ${capture.offlineWindows.length} périodes hors écran observées.`
    )
  )
  if (capture.incomplete)
    target.append(text('p', 'Attention : plafond de capture atteint, certaines données sont manquantes.'))
  const labels = {
    live: 'Direct',
    offline: 'Hors écran',
    gathered: 'Récolté',
    construction: 'Consommé : construction',
    meals: 'Consommé : repas',
    craftConsumed: 'Consommé : craft',
    craftProduced: 'Produit : craft',
    renewed: 'Renouvelé sur la carte',
    supplied: 'Approvisionnement RPG',
    payment: 'Autres paiements',
    refund: 'Remboursement',
  }
  function duration(player) {
    const windows = capture.offlineWindows
      .filter(w => player === 'monde' || w.players.includes(player))
      .map(w => [w.fromMs, w.toMs])
      .sort((a, b) => a[0] - b[0])
    let total = 0,
      end = -Infinity
    for (const [start, stop] of windows) {
      total += Math.max(0, stop - Math.max(start, end))
      end = Math.max(end, stop)
    }
    return total
  }
  const table = (headers, rows) => renderFlowTable(headers, rows, text)
  const phaseLabels = {
    harvest: 'Récolte',
    travel: 'Trajets',
    pause: 'Pauses',
    build: 'Construction',
    craft: 'Craft',
    other: 'Non attribué',
  }
  target.append(text('h3', 'Objectifs chronométrés en partie'))
  if (!capture.objectives?.length)
    target.append(
      text(
        'p',
        'Aucun objectif chronométré dans cette capture. Les flux agrégés ne permettent pas de reconstituer sa durée.'
      )
    )
  for (const measurement of capture.objectives ?? []) {
    target.append(text('h3', measurement.id + (measurement.completed ? ' — terminé (déclaré)' : ' — non terminé')))
    target.append(
      text(
        'p',
        'Temps réel écoulé : ' +
          number(measurement.realMs / 60000) +
          ' min ; horloge du jeu : ' +
          number(measurement.gameMs / 1000) +
          ' s.'
      )
    )
    const totals = {}
    for (const segment of measurement.segments) {
      const value = totals[segment.phase] ?? (totals[segment.phase] = { realMs: 0, gameMs: 0 })
      value.realMs += segment.realMs
      value.gameMs += segment.gameMs
    }
    target.append(
      table(
        ['Phase indiquée manuellement', 'Temps réel (s)', 'Horloge du jeu (s)'],
        Object.entries(totals).map(([phase, value]) => [
          phaseLabels[phase],
          number(value.realMs / 1000),
          number(value.gameMs / 1000),
        ])
      )
    )
  }
  target.append(
    table(
      ['Mode', 'Joueur / périmètre', 'Flux', 'Ressource / objet', 'Quantité', '/ jour observé'],
      capture.rows.map(row => {
        const ms = row.mode === 'live' ? capture.elapsedMs : duration(row.player)
        return [
          labels[row.mode],
          row.player,
          labels[row.kind],
          row.resource,
          number(row.amount),
          ms > 0 ? number((row.amount * dayLengthMs) / ms) : '—',
        ]
      })
    )
  )
  const stockRows = []
  for (const stock of capture.stocks)
    for (const key of new Set([...Object.keys(stock.before), ...Object.keys(stock.after)])) {
      const before = stock.before[key] || 0,
        after = stock.after[key] || 0
      const net = capture.rows
        .filter(row => row.player === stock.player && row.resource === key)
        .reduce((sum, row) => {
          if (['gathered', 'craftProduced', 'supplied', 'refund'].includes(row.kind)) return sum + row.amount
          if (['construction', 'meals', 'craftConsumed', 'payment'].includes(row.kind)) return sum - row.amount
          return sum
        }, 0)
      stockRows.push([
        stock.player,
        key,
        number(before),
        number(after),
        number(after - before),
        number(after - before - net),
      ])
    }
  target.append(text('h3', 'Stocks des joueurs chargés au début et à la fin'))
  target.append(table(['Joueur', 'Ressource', 'Début', 'Fin', 'Variation', 'Écart non expliqué'], stockRows))
  target.append(
    text(
      'p',
      'L’écart non expliqué signale notamment les achats, butins, pertes, contenus chargés/déchargés ou flux non instrumentés. Les renouvellements restent sur la carte et ne sont jamais ajoutés aux stocks. Les objets craftés (item:) sont comptés en objets, séparément des ressources.'
    )
  )
  const ranges = document.createElement('details')
  ranges.append(text('summary', 'Périodes de simulation observées'))
  ranges.append(
    table(
      ['Du (ms de jeu)', 'Au (ms de jeu)', 'Joueurs'],
      capture.offlineWindows.map(w => [number(w.fromMs), number(w.toMs), w.players.join(', ')])
    )
  )
  target.append(ranges)
}

function extendedSections(report, { escape, format, cost, table, row }) {
  const categories = {
    equipment: 'Équipement',
    arrows: 'Flèches',
    cooking: 'Cuisine',
    potions: 'Remèdes',
    ingots: 'Lingots',
  }
  const materials = { ceramic: 'Pierre (initial)', copper: 'Cuivre', bronze: 'Bronze', iron: 'Fer' }
  const crafts = report.crafts ?? [],
    technologies = report.technologies ?? []
  const encoded = JSON.stringify(report.capture ?? null).replace(/</g, '\\u003c')
  return `<section id="crafts"><h2>Crafts disponibles · ${crafts.length} recettes</h2><p class="muted">Catalogue actuel, toutes civilisations. Chaque recette exige l’accès à une station achevée et les matériaux disponibles localement. La culture de la forge détermine les variantes culturelles ; aucun ancien arbre de recherche n’est ajouté.</p>
<div class="controls"><label for="craft-search">Rechercher une recette</label><input type="search" id="craft-search" placeholder="Épée, bronze, lingot…"><label for="craft-civ">Culture de la forge</label><select id="craft-civ"><option value="">Toutes</option>${[
    ...new Set(crafts.flatMap(c => c.civilizations)),
  ]
    .sort()
    .map(c => `<option>${escape(c)}</option>`)
    .join('')}</select></div>
${table(
  [
    'Recette / résultat',
    'Station',
    'Catégorie',
    'Quantité produite',
    'Coût du lot',
    'Coût / objet',
    'Coût brut avec fonte',
    'Civilisations',
  ],
  crafts.map(
    c =>
      `<tr data-craft data-civs="${escape(c.civilizations.join(','))}">${[
        `${escape(c.label)}<small>${escape(c.id)}</small>`,
        c.station === 'forge'
          ? `Forge N${(c.requiredForgeLevel ?? 0) + 1}`
          : c.station === 'inventory'
            ? 'Inventaire'
            : 'Feu de camp',
        categories[c.category] ?? escape(c.category),
        format(c.outputCount),
        cost(c.cost),
        cost(c.costPerOutput),
        cost(c.rawCost),
        c.civilizations.length === 8 ? 'Toutes' : escape(c.civilizations.join(', ')),
      ]
        .map(v => `<td>${v}</td>`)
        .join('')}</tr>`
  )
)}
<p class="muted">Le coût brut décompose les lingots en minerai et combustible. Les lots sont ceux du jeu ; les coûts unitaires fractionnaires sont des ratios, pas une possibilité de fabriquer une fraction de lot. Les recettes manuelles actuelles n’ont pas de durée de fabrication configurée.</p></section>
<section id="technologies"><h2>Matériaux et rendement des outils</h2><p>Les recettes sont accessibles sans découverte technologique. La fabrication demande les ressources et l’atelier appropriés. Les rendements ci-dessous dépendent de l’outil réellement équipé.</p>
${table(
  [
    'Palier',
    'Matériau de fabrication',
    'Bonus bois / récolte',
    'Bonus minerais / récolte',
    'Construction',
    'Extraction du fer',
  ],
  technologies.map(t =>
    row([
      materials[t.material] ?? escape(t.material),
      t.resource ? `Lingot : ${cost({ [t.resource]: 1 })}` : 'Bois et pierre',
      `+${t.woodBonus}`,
      `+${t.miningBonus}`,
      `× ${format(t.buildMultiplier)}`,
      t.canMineIron ? 'Oui, pioche de ce matériau équipée' : 'Non avec ce matériau',
    ])
  )
)}
<p class="muted">Les bonus s’ajoutent aux quantités par récolte, pas à un rendement par seconde. La construction utilise un multiplicateur de travail. Héros et villageois doivent équiper leurs outils réels ; la possession d’un lingot ne les améliore pas automatiquement. Les anciennes recherches payantes sont retirées par la migration des sauvegardes.</p></section>
<section id="flows"><h2>Bilan sur une période jouée</h2><p>Récoltes, repas, constructions, crafts, paiements et renouvellements, séparés entre direct et simulation hors écran. Les livraisons entre sacs et dépôts ne créent pas une deuxième récolte.</p>
<ol><li>Dans la console du jeu (Entrée), lancer <code>economy-flow start</code>.</li><li>Jouer, puis lancer <code>economy-flow stop</code> et <code>economy-flow export</code>.</li><li>Charger le fichier ci-dessous, ou relancer l’audit avec <code>--capture chemin/economy-flow.json</code>.</li></ol>
<details><summary>Chronométrer un objectif et ses étapes</summary><p>Après <code>economy-flow start</code>, lancer <code>economy-flow goal maison</code> (ou <code>hache-cuivre</code>, <code>bronze</code>). Indiquer les changements d’activité avec <code>economy-flow phase harvest</code>, puis <code>travel</code>, <code>pause</code>, <code>build</code> ou <code>craft</code>. Terminer par <code>economy-flow finish</code>, puis arrêter et exporter la capture.</p><p>Un seul objectif à la fois. Les étapes sont annotées par le joueur : aucune attribution automatique des travailleurs. La phase initiale « other » reste non attribuée. Le temps réel inclut les pauses et le temps passé dans la console ; l’horloge du jeu peut avancer différemment. Arrêter la capture ne déclare pas un objectif réussi. Noter les stocks, travailleurs et distances dans le scénario pour comparer des conditions équivalentes.</p></details>
<div class="controls"><label for="capture-file">Importer une capture JSON</label><input type="file" id="capture-file" accept="application/json,.json"></div><p id="capture-error" role="alert"></p><div id="flow-content"></div>
<p class="muted">Les captures commencent à la demande. Elles n’inventent pas les événements des anciennes parties. Les taux par jour sont des moyennes sur la période observée, pas par travailleur : durée de capture pour le direct, union des fenêtres de simulation du joueur pour le hors écran. Un rattrapage peut précéder le début de capture ; les deux modes ne sont donc pas automatiquement comparables.</p>
<p class="muted">Couverture : récoltes, matériaux de chantier/rénovation, repas, craft manuel, flèches de ville et remplacement automatique des outils, paiements via le registre commun, réapprovisionnement RPG, repousse des baies et réinitialisation du potentiel du blé. Les jeunes cultures ne sont pas immédiatement récoltables. Chasse/naissances, maturité, butins, marchés et stocks déchargés ne sont pas suivis exhaustivement ; ils peuvent expliquer un écart de stock.</p></section>
<script type="application/json" id="flow-data">${encoded}</script>
<script>
const kinds = ['gathered','construction','meals','craftConsumed','craftProduced','renewed','supplied','payment','refund'];
${validateCapture.toString()}
${renderFlowTable.toString()}
${renderFlowCapture.toString()}
const flowTarget = document.getElementById('flow-content');
renderFlowCapture(JSON.parse(document.getElementById('flow-data').textContent),flowTarget,${DAY_NIGHT_CONFIG.dayLengthMs});
document.getElementById('capture-file').addEventListener('change', async event => {
 const error = document.getElementById('capture-error'); error.textContent='';
 try { const file=event.target.files[0]; if(!file)return; if(file.size>20000000)throw new Error('Capture trop volumineuse (maximum 20 Mo).');
 const capture=validateCapture(JSON.parse(await file.text())); renderFlowCapture(capture,flowTarget,${DAY_NIGHT_CONFIG.dayLengthMs});
 } catch(e){error.textContent=e.message;}
});
function filterCrafts(){const query=document.getElementById('craft-search').value.toLocaleLowerCase('fr'), civ=document.getElementById('craft-civ').value;
 document.querySelectorAll('[data-craft]').forEach(row=>{row.hidden=!row.textContent.toLocaleLowerCase('fr').includes(query)||(civ&&!row.dataset.civs.split(',').includes(civ));});}
document.getElementById('craft-search').addEventListener('input',filterCrafts);document.getElementById('craft-civ').addEventListener('change',filterCrafts);
</script>`
}
module.exports = { extendedSections }

function renderFlowTable(headers, rows, text) {
  const wrapper = document.createElement('div')
  wrapper.className = 'table-wrap'
  const table = document.createElement('table'),
    head = document.createElement('thead'),
    body = document.createElement('tbody'),
    heading = document.createElement('tr')
  for (const label of headers) heading.append(text('th', label))
  head.append(heading)
  for (const cells of rows) {
    const row = document.createElement('tr')
    for (const cell of cells) row.append(text('td', cell))
    body.append(row)
  }
  table.append(head, body)
  wrapper.append(table)
  return wrapper
}
