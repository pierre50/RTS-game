const { groundResourceSection } = require('./ground-resources.cjs')
const { npcEquipmentSection } = require('./npc-equipment.cjs')
const { simulationSection } = require('./simulation.cjs')
const { supplySection } = require('./supply.cjs')
const { objectiveSection } = require('./objectives.cjs')
const { toolLifetimeSection } = require('./tool-lifetime.cjs')
const { performanceSections } = require('./performance.cjs')
const { extendedSections } = require('./sections.cjs')
const escape = value =>
  String(value ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )
const format = value =>
  value == null ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value)
const labels = {
  copperIngot: 'lingot de cuivre',
  bronzeIngot: 'lingot de bronze',
  ironIngot: 'lingot de fer',
  sinew: 'tendon',
  feather: 'plume',
  wood: 'bois',
  stone: 'pierre',
  fiber: 'fibre',
  wheat: 'blé',
  berry: 'baies',
  meat: 'viande',
  gold: 'or',
  copper: 'cuivre',
  tin: 'étain',
  iron: 'fer',
  herb: 'herbes médicinales',
  toxicHerb: 'herbes toxiques',
  food: 'nourriture',
  leather: 'cuir',
}
const resourceLabel = key => labels[key] ?? key
const names = {
  House: 'Maison',
  Farm: 'Semis',
  Barracks: 'Caserne',
  Granary: 'Grenier',
  StoragePit: 'Dépôt',
  ArcheryRange: 'Archerie',
  Stable: 'Écurie',
  WatchTower: 'Tour de guet',
  SmallWall: 'Mur',
  Trap: 'Piège',
  Cave: 'Grotte',
  Chest: 'Coffre',
  Market: 'Marché',
  Temple: 'Temple',
  TownCenter: 'Centre-ville',
  FireCamp: 'Feu de camp',
  Forge: 'Forge',
}
const name = type => (names[type] ? `${names[type]} <small>${escape(type)}</small>` : escape(type))
const cost = value =>
  value == null
    ? 'Non défini'
    : Object.entries(value)
        .filter(([, amount]) => amount > 0)
        .map(([key, amount]) => `<span class="material">${format(amount)} ${escape(resourceLabel(key))}</span>`)
        .join(' ') || 'Aucun matériau'
const table = (headers, rows) =>
  `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`
const row = cells => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`

const constructionDuration = estimate => {
  if (!estimate) return '—'
  const unit = { minutes: 'min de travail de jeu', hours: 'h de jeu', days: 'jours de jeu' }[estimate.unit]
  return `${format(estimate.value)} ${estimate.unit === 'days' && estimate.value === 1 ? 'jour de jeu' : unit}<br><small>${format(estimate.workers)} ouvriers novices · outils en ${estimate.toolMaterial === 'bronze' ? 'bronze' : 'pierre'}</small>`
}
const constructionDurationMethod =
  'Estimations après livraison de tous les matériaux, pour deux ouvriers novices en difficulté normale. Outils en pierre pour les bases, en bronze pour les niveaux améliorés. Une journée de jeu dure 24 minutes réelles, avec environ dix heures de travail de jeu par ouvrier (repas et nuit exclus). Le cycle de travail inclut la récupération d’énergie théorique. Trajets, interruptions et fabrication/remplacement des outils ne sont pas simulés ; ces durées ne sont pas des échéances garanties.'

function renderReport(report) {
  const m = report.map
  const buildings = decoration =>
    report.buildings
      .filter(b => b.decoration === decoration)
      .map(b =>
        row([
          name(b.type),
          format(b.level),
          cost(b.cost),
          format(b.constructionWork),
          constructionDuration(b.constructionDuration),
          format(b.shelterCapacity),
          format(b.beds),
          format(b.hitPoints),
          format(b.storageCapacity),
          b.arrivals ? `${format(b.arrivals.maxArrivals)} / ${format(100 * b.arrivals.growthRate)} %` : '—',
          b.towerCombat
            ? `${format(b.towerCombat.power)} / ${format(b.towerCombat.range)} / ${format(b.towerCombat.targets)}`
            : '—',
          format(b.trainingCapacity),
          Object.entries(b.trainingExperience ?? {})
            .flatMap(([unit, skills]) =>
              Object.entries(skills).map(([skill, xp]) => `${escape(unit)} : ${format(xp)} XP (${escape(skill)})`)
            )
            .join('<br>') || '—',
          b.size == null ? '—' : `${b.size} × ${b.size}`,
          b.costPerShelterPlace ? cost(b.costPerShelterPlace) : '—',
          b.conditions.length ? escape(JSON.stringify(b.conditions)) : 'Non renseigné',
        ])
      )
  const buildingHeaders = [
    'Bâtiment',
    'Niveau',
    'Construction neuve',
    'Travail¹',
    'Durée estimée³',
    'Abri²',
    'Lits initiaux',
    'PV',
    'Stockage',
    'Arrivées max/jour / croissance',
    'Défense : puissance / portée / cibles',
    'Formations simultanées',
    'XP de départ',
    'Empreinte',
    'Coût / place d’abri²',
    'Conditions configurées',
  ]
  const house = report.buildings.find(b => b.type === 'House' && b.level === 0)
  const houseUpgrade = report.upgrades.find(b => b.type === 'House' && b.fromLevel === 0)
  const axisSize = Math.ceil(m.stride / m.zoneSize)
  const cards = [
    ['Variantes de bâtiments', format(report.buildings.length), `${report.upgrades.length} rénovations adjacentes`],
    ['Cases terrestres', format(m.landCells), `${format(m.waterCells)} cases d’eau`],
    ['Maison • niveau 0', house ? cost(house.cost) : '—', house ? `${house.beds} lits initiaux` : ''],
    [
      'Maison • rénovation 0 → 1',
      houseUpgrade ? cost(houseUpgrade.cost) : '—',
      houseUpgrade ? `+${houseUpgrade.addedShelter} places d’abri configurées` : '',
    ],
  ]
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kaelor · Audit économique</title>
<style>
:root{color-scheme:light;--ink:#182c2b;--muted:#5b6f6c;--line:#d9e4df;--accent:#176e57}*{box-sizing:border-box}body{margin:0;background:#f3f6f1;color:var(--ink);font:15px/1.55 system-ui,sans-serif}main{max-width:1440px;margin:auto;padding:40px 32px 70px}header{border-bottom:1px solid var(--line);padding-bottom:25px}h1{font-size:clamp(30px,4vw,46px);line-height:1.1;letter-spacing:-1.5px;margin:8px 0 16px}h2{font-size:25px;letter-spacing:-.5px;margin:0 0 12px}h3{font-size:17px;margin:0 0 8px}p{margin:8px 0 15px}.eyebrow{font-size:12px;font-weight:750;letter-spacing:2px;color:var(--accent)}.muted,small{color:var(--muted)}small{display:block;font-size:11px}.tag{display:inline-block;padding:4px 10px;background:#dcece4;border-radius:20px;font-size:12px}nav{display:flex;gap:18px;flex-wrap:wrap;margin-top:20px}a{color:var(--accent);text-underline-offset:4px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:28px 0}.card,section{background:#fff;border:1px solid var(--line);border-radius:14px;padding:22px}.card strong{display:block;font-size:25px;line-height:1.45;margin:10px 0}.card .material{font-size:16px}.card p{font-size:12px;margin:0;color:var(--muted)}section{margin-top:22px;scroll-margin-top:20px}.table-wrap{overflow:auto;max-height:650px}table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;white-space:nowrap;background:#edf3ed;color:#435b53;position:sticky;top:0;z-index:1;font-size:11px;text-transform:uppercase;letter-spacing:.5px}th,td{padding:12px;border-bottom:1px solid #e6ece6;vertical-align:top}tbody tr:hover{background:#f5f8f2}.material{display:inline-block;white-space:nowrap;margin:2px 6px 2px 0}input,select{font:inherit;padding:9px 12px;border:1px solid #b9cdc2;border-radius:8px;background:white;color:var(--ink)}input{width:min(100%,350px)}.controls{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:18px 0}.map-layout{display:grid;grid-template-columns:minmax(240px,570px) 1fr;gap:25px;align-items:start}svg{width:100%;background:#edf2ee;border-radius:10px}svg rect:hover{stroke:#152d28;stroke-width:.12}.legend{height:10px;border-radius:4px;background:linear-gradient(to right,#e9f2ec,#16734b);margin:12px 0 5px}.legend-labels{display:flex;justify-content:space-between;font-size:12px}.finding{border-left:3px solid #c69945;background:#faf7ee;padding:12px 16px;margin:10px 0}.finding p{margin:0;font-size:13px}.notes{padding-left:20px}.notes li{margin:9px 0}.source{overflow-wrap:anywhere;font-family:monospace;font-size:11px}details{margin-top:20px}summary{cursor:pointer;font-weight:650}footer{margin-top:22px;color:var(--muted);font-size:12px}[hidden]{display:none!important}@media(max-width:900px){.cards{grid-template-columns:repeat(2,1fr)}.map-layout{grid-template-columns:1fr}}@media(max-width:550px){main{padding:22px 14px}.cards{grid-template-columns:1fr}section{padding:16px}}@media print{.controls,nav{display:none}.table-wrap{max-height:none;overflow:visible}section{break-inside:auto}body{background:white}main{padding:0}}
</style></head><body><main>
<header><div class="eyebrow">KAELOR / OBSERVATOIRE DU GAMEPLAY</div><h1>Audit de l’économie</h1><p>Coûts, rénovations et ressources initiales. Une base chiffrée pour choisir les prochains tests de gameplay.</p><span class="tag">${escape(report.mode)}</span> <span class="muted">${escape(m.id)}</span><nav><a href="#buildings">Constructions</a><a href="#upgrades">Rénovations</a><a href="#resources">Ressources</a><a href="#ground-resources">Ramassables</a><a href="#distribution">Répartition</a><a href="#crafts">Crafts</a><a href="#technologies">Matériaux</a><a href="#weapons">Armes et dégâts</a><a href="#tools">Outils et rendement</a><a href="#tool-lifetime">Usure et bâtiments</a><a href="#npc-equipment">Équipement PNJ</a><a href="#supply">Approvisionnement</a><a href="#objectives">Objectifs et durée</a><a href="#simulation">Simulation</a><a href="#flows">Bilan joué</a><a href="#method">Méthode et sources</a><a href="economy.json" download>Données JSON</a></nav></header>
<div class="cards">${cards.map(([title, value, sub]) => `<div class="card"><p>${title}</p><strong>${value}</strong><p>${sub}</p></div>`).join('')}</div>
<section><h2>Points à examiner</h2><p class="muted">Ces observations orientent les tests ; elles ne concluent pas à un déséquilibre.</p>${report.findings.map(f => `<div class="finding"><h3>${escape(f.title)}</h3><p>${escape(f.detail)}</p></div>`).join('') || '<p>Aucune observation automatique sur les améliorations.</p>'}${m.warnings.map(w => `<div class="finding">${escape(w)}</div>`).join('')}</section>
<section id="buildings"><h2>Construire à chaque niveau</h2><p class="muted">Coût complet d’un bâtiment neuf au niveau indiqué. L’approvisionnement ne fait pas avancer les travaux ; la construction démarre une fois tout livré. La présence dans ce tableau ne garantit pas la disponibilité dans le menu du joueur.</p><div class="controls"><label for="search">Rechercher un bâtiment</label><input id="search" placeholder="Maison, House, Forge…" type="search"></div><div class="searchable">${table(buildingHeaders, buildings(false))}<details><summary>Décorations et mobilier (${report.buildings.filter(b => b.decoration).length} variantes)</summary>${table(buildingHeaders, buildings(true))}</details></div><p class="muted">¹ Unités de travail, pas des secondes. ² Capacité d’abri configurée, pas le nombre de lits disponibles. Farm correspond à un semis d’une case.</p><p class="muted">³ ${constructionDurationMethod}</p></section>
<section id="upgrades"><h2>Améliorer un bâtiment existant</h2><p class="muted">Coûts explicites de rénovation par niveau, partagés avec le jeu. Les anciennes définitions sans prix explicite utilisent la différence positive de matériaux. Le travail est indépendant du prix et commence après approvisionnement complet.</p>${table(
    [
      'Bâtiment',
      'Transition',
      'Matériaux supplémentaires',
      'Travail¹',
      'Durée estimée³',
      'Gain d’abri²',
      'Gain de PV',
      'Coût / place ajoutée²',
    ],
    report.upgrades.map(u =>
      row([
        name(u.type),
        `${u.fromLevel} → ${u.toLevel}`,
        cost(u.cost),
        format(u.constructionWork),
        constructionDuration(u.constructionDuration),
        format(u.addedShelter),
        format(u.addedHitPoints),
        u.costPerAddedShelterPlace ? cost(u.costPerAddedShelterPlace) : '—',
      ])
    )
  )}<p class="muted">³ ${constructionDurationMethod}</p></section>
<section id="resources"><h2>Stock initial déclaré sur la carte</h2><p class="muted">La quantité par gisement vient de la carte ; à défaut, sa capacité ou la définition du jeu est utilisée. La capacité cumulée est un plafond initial, pas un rendement renouvelable.</p>${table(
    [
      'Ressource',
      'Gisements',
      'Quantité initiale',
      'Capacité cumulée',
      '/ 100 cases terrestres',
      '/ 100 cases valides',
      'Quantité par défaut',
    ],
    m.resources.map(r =>
      row([
        `${escape(resourceLabel(r.resource))}<small>${escape(r.type)}</small>`,
        format(r.nodes),
        format(r.quantity),
        format(r.capacity),
        format(r.per100LandCells),
        format(r.per100Cells),
        format(r.defaultsUsed),
      ])
    )
  )}</section>
<section id="distribution"><h2>Répartition par zone</h2><p class="muted">Zones de ${m.zoneSize} × ${m.zoneSize} coordonnées. Chaque densité utilise le nombre réel de cases terrestres de la zone, y compris aux bords. Survoler une case pour le détail.</p><div class="controls"><label for="resource">Ressource</label><select id="resource">${m.resources.map(r => `<option value="${escape(r.resource)}"${r.resource === 'wood' ? ' selected' : ''}>${escape(resourceLabel(r.resource))}</option>`).join('')}</select></div><div class="map-layout"><div><svg role="img" aria-label="Densité des ressources par zone de coordonnées" viewBox="0 0 ${axisSize} ${axisSize}">${m.zones.map(z => `<rect x="${z.j / m.zoneSize}" y="${z.i / m.zoneSize}" width=".95" height=".95" data-land="${z.landCells}" data-i="${z.i}" data-j="${z.j}" data-quantities="${escape(JSON.stringify(z.quantities))}" fill="#e9f2ec"><title>Zone ${z.i}, ${z.j}</title></rect>`).join('')}</svg><div class="legend"></div><div class="legend-labels"><span>0</span><span id="max-density"></span></div></div><div><h3>Lire cette carte</h3><p>Plus le vert est foncé, plus la ressource est concentrée par case terrestre. L’échelle est recalculée pour chaque ressource.</p><p>Les zones sans terre sont grisées. Le dessin suit les coordonnées de stockage, et non la perspective isométrique à l’écran.</p><p class="muted">Cette vue mesure une répartition physique. Elle ne tient pas compte des chemins, de la propriété, des ennemis ou de la maturité des cultures.</p><details><summary>Tableau des zones, accessible sans survol</summary><div id="zone-table"></div></details><noscript>La vue interactive nécessite JavaScript. Toutes les quantités par zone sont également disponibles dans economy.json.</noscript></div></div></section>
${performanceSections(report, { escape, format, table, row, cost })}
${toolLifetimeSection(report, { escape, format, table, row, cost, name })}
${npcEquipmentSection(report, { escape, format, cost, table, row })}
${groundResourceSection(report, { escape, format, cost, table, row })}
${supplySection(report, { escape, format, cost, table, row })}
${objectiveSection(report, { escape })}
${simulationSection(report, { table, row, format })}
${extendedSections(report, { escape, format, cost, table, row })}
<section id="method"><h2>Méthode et limites</h2><ul class="notes">${report.notes.map(n => `<li>${escape(n)}</li>`).join('')}</ul><details><summary>Sources et empreintes SHA-256</summary>${report.sources.map(s => `<p class="source">${escape(s.path)}<br>${escape(s.sha256)}</p>`).join('')}</details></section>
<footer>Généré le ${escape(new Date(report.generatedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }))} (Paris). Relancer l’audit après une modification du jeu ou de la carte.</footer></main>
<script>
const number = value => new Intl.NumberFormat('fr-FR', {maximumFractionDigits:2}).format(value);
document.getElementById('search').addEventListener('input', event => {
  const query = event.target.value.toLocaleLowerCase('fr');
  document.querySelectorAll('.searchable tbody tr').forEach(row => {row.hidden = !row.cells[0].textContent.toLocaleLowerCase('fr').includes(query)});
});
const selector = document.getElementById('resource');
function updateMap() {
  const key = selector.value;
  const rectangles = [...document.querySelectorAll('svg rect')];
  const rows = rectangles.map(rect => ({rect, amount: JSON.parse(rect.dataset.quantities)[key] || 0, land:Number(rect.dataset.land)}));
  const max = rows.reduce((max,row) => Math.max(max,row.land ? row.amount*100/row.land : 0),0);
  const table = document.createElement('table');
  const head = document.createElement('thead'); const tr = document.createElement('tr');
  ['Zone i, j','Stock','/ 100 terres'].forEach(label => {const th=document.createElement('th');th.textContent=label;tr.append(th)});head.append(tr);table.append(head);
  const body = document.createElement('tbody');
  for(const row of rows) {
    const density = row.land ? row.amount*100/row.land : 0, t = max ? density/max : 0;
    row.rect.setAttribute('fill',row.land ? 'rgb('+[233+(22-233)*t,242+(115-242)*t,236+(75-236)*t].map(Math.round).join(',')+')' : '#d9dfdc');
    row.rect.querySelector('title').textContent='Zone '+row.rect.dataset.i+', '+row.rect.dataset.j+' : '+number(row.amount)+' unités ; '+(row.land ? number(density)+' / 100 cases terrestres' : 'sans terre');
    const tr=document.createElement('tr'); [row.rect.dataset.i+', '+row.rect.dataset.j,number(row.amount),row.land ? number(density) : '—'].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td)});body.append(tr);
  }
  table.append(body);const wrapper=document.createElement('div');wrapper.className='table-wrap';wrapper.append(table);document.getElementById('zone-table').replaceChildren(wrapper);
  document.getElementById('max-density').textContent=number(max)+' / 100 cases terrestres';
}
selector.addEventListener('change',updateMap);updateMap();
</script></body></html>`
}
module.exports = { renderReport }
