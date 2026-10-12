const { loadGenerationTs: load } = require('../maps/load-generation-ts.cjs')
const { NATURAL_RESOURCE_REGROWTH_BY_TYPE } = load('app/config/gameplay.ts')
const { HERO_CRAFT_RECIPES } = load('app/lib/hero/heroCraftRecipes.ts')
const { simulateOfflineWorld } = load('app/services/world/offline/OfflineWorldSimulation.ts')
const { canAutonomouslyWork } = load('app/lib/equipment/workTools.ts')

// Isolated scenes execute the actual economy; no user map or save is advanced.
function constructionCheck(useDepot, bootstrap = false, loaded = false) {
  const unit = {
    type: 'Villager',
    label: 'audit-builder',
    i: 10,
    j: 10,
    inactif: true,
    autonomousJob: 'construction',
    inventory: {
      toolsInitialized: true,
      activeWeapons: bootstrap ? {} : { tool: 'hammer_ceramic' },
      equipment: bootstrap ? (loaded ? ['sword_ceramic'] : []) : ['axe_ceramic', 'pickaxe_ceramic'],
      resources: { wheat: bootstrap && !loaded ? 2 : 12 },
    },
  }
  const site = {
    type: 'House',
    label: 'site',
    i: 12,
    j: 12,
    isBuilt: false,
    hitPoints: 1,
    totalHitPoints: 11,
    constructionMaterials: { cost: { wood: 2, stone: 2 }, delivered: {}, consumed: {} },
  }
  const stock = useDepot ? { wood: 2, stone: 2 } : {}
  const player = {
    type: 'Human',
    label: 'audit',
    units: [unit],
    buildings: [
      site,
      { type: 'TownCenter', label: 'town', i: 5, j: 5, isBuilt: true },
      { type: 'StoragePit', label: 'depot', i: 7, j: 7, isBuilt: true, inventory: { resources: stock } },
    ],
  }
  const state = {
    players: [player],
    animals: [],
    camera: { x: 0, y: 0 },
    resources: Array.from({ length: bootstrap ? 31 : 8 }, (_, n) => ({
      type: n < (bootstrap ? 14 : 4) ? 'GroundWood' : 'GroundStone',
      label: `ground-${n}`,
      i: 15 + (bootstrap ? Math.floor(n / 10) : n),
      j: bootstrap ? 5 + (n % 10) : 12,
      quantity: 1,
      totalQuantity: 1,
      isNaturalResource: true,
    })),
  }
  const terrain = Array.from({ length: 40 }, () => Array.from({ length: 40 }, () => ({ category: 'Land' })))
  const gathered = {}
  let elapsedMs = 0
  while (elapsedMs < 180000 && !site.isBuilt) {
    const report = simulateOfflineWorld(state, {
      fromElapsedMs: elapsedMs,
      toElapsedMs: elapsedMs + 1000,
      terrain,
      unitConfig: () => ({ speed: 1.5, gatherAmount: { forager: 1 } }),
      buildingConfig: () => ({ size: 1, constructionTime: 4, totalHitPoints: 11 }),
      cycleMs: () => 1000,
      wheatMatureFrame: 5,
      spatialOptions: { traceConnectivity: false, protectVillageAccess: false },
      runtimeOwnsMeals: true,
      runtimeOwnsDailyEvents: true,
      runtimeOwnsTraining: true,
    })
    for (const [key, amount] of Object.entries(report.gathered)) gathered[key] = (gathered[key] ?? 0) + amount
    elapsedMs += 1000
  }
  const expectedWood = bootstrap ? 14 : useDepot ? 0 : 2
  const expectedStone = bootstrap ? 17 : expectedWood
  return {
    label: bootstrap
      ? loaded
        ? 'Sac chargé, outils successifs puis chantier'
        : 'Départ sans outils, fabrication puis chantier'
      : useDepot
        ? 'Stock du dépôt prioritaire'
        : 'Chantier alimenté par ramassage',
    mode: 'offline-engine',
    completed: Boolean(site.isBuilt),
    elapsedGameMs: elapsedMs,
    gathered,
    consumed: site.constructionMaterials.consumed,
    remainingNodes: state.resources.length,
    respawnSlots: state.naturalResourceRespawnSlots?.length ?? 0,
    passed:
      Boolean(site.isBuilt) &&
      (gathered.wood ?? 0) === expectedWood &&
      (gathered.stone ?? 0) === expectedStone &&
      site.constructionMaterials.consumed.wood === 2 &&
      site.constructionMaterials.consumed.stone === 2 &&
      state.resources.length === (bootstrap ? 31 : 8) - expectedWood - expectedStone,
  }
}
function groundResourceCatalogue(mapReport, definitions, map) {
  const resources = ['GroundWood', 'GroundStone'].map(type => {
    const placed = mapReport.resources.find(resource => resource.type === type)
    return {
      type,
      resource: type === 'GroundWood' ? 'wood' : 'stone',
      quantityPerNode: definitions[type]?.quantity ?? definitions[type]?.totalQuantity ?? null,
      initialNodes: placed?.nodes ?? 0,
      initialQuantity: placed?.quantity ?? 0,
      ...NATURAL_RESOURCE_REGROWTH_BY_TYPE[type],
      placement: type === 'GroundWood' ? 'À proximité des arbres vivants' : 'Sur un emplacement terrestre libre',
      solid: false,
      toolWear: false,
    }
  })
  const actor = { inventory: { activeWeapons: { tool: 'hammer_ceramic' } } }
  return {
    resources,
    generation: map.generation?.groundResources ?? null,
    stoneToolRecipes: HERO_CRAFT_RECIPES.filter(recipe =>
      /^(axe|pickaxe|hammer|scythe)_ceramic$/.test(recipe.outputEquipment)
    ).map(recipe => ({ item: recipe.outputEquipment, station: recipe.station, cost: recipe.cost })),
    construction: {
      depotFirst: true,
      hammerCanCollect: canAutonomouslyWork(actor, 'wood', true),
      hammerCanChop: canAutonomouslyWork(actor, 'wood'),
      brokenToolRecoveryFirst: true,
    },
    visualMirroring: {
      implemented: true,
      probability: 0.5,
      persistence: 'deterministic-placement',
      affectsEconomy: false,
    },
    checks: [
      constructionCheck(false),
      constructionCheck(true),
      constructionCheck(false, true),
      constructionCheck(false, true, true),
    ],
  }
}
function groundResourceSection(report, { table, row, escape, cost, format }) {
  const data = report.groundResources
  if (!data) return ''
  return `<section id="ground-resources"><h2>Ramassables et réapparition</h2>
${data.resources.every(r => r.initialNodes === 0) ? '<p class="finding">Cette carte ne contient aucun ramassable. Régénérer la carte avec le générateur actuel pour en placer ; cet audit ne modifie pas la carte.</p>' : ''}
<p>Branches et cailloux non solides : une unité par collecte, sans usure d’outil. Le héros utilise E ; sac plein, l’objet reste au sol. Les quantités ci-dessous sont déjà incluses dans le stock de surface, elles ne s’y ajoutent pas.</p>
${table(
  ['Objet', 'Unités / objet', 'Objets initiaux', 'Stock initial', 'Délai après collecte', 'Placement'],
  data.resources.map(r =>
    row([
      escape(r.type),
      format(r.quantityPerNode),
      format(r.initialNodes),
      format(r.initialQuantity),
      `${format(r.respawnDelayDays)} jours`,
      escape(r.placement),
    ])
  )
)}
<p>La collecte d’une ressource naturelle crée un emplacement de réapparition sauvegardé. Réapparition locale sur une case libre, sans accumulation ; si aucun emplacement ne convient, nouvel essai le jour suivant. Les branches attendent un arbre vivant proche. Ces délais ne garantissent donc pas un rendement par jour.</p>
<p>Répartition uniforme en pleine nature, sans bonus ni exclusion spéciale au départ : branches près des arbres, pierres dispersées, au moins ${escape(data.generation?.minDistance ?? '?')} cases entre deux ramassables. Les emprises des villages existants, les abords des bâtiments et les routes sont exclus. La réapparition conserve cet espacement et évite les bâtiments.</p>
<h3>Outils cassés et chantiers</h3><p>Stock local utilisable en priorité, puis fabrication payée. Sans métal disponible, le villageois ramasse les matériaux manquants pour un outil en pierre. Aucun renouvellement gratuit. Un chantier déclenche la préparation des outils manquants, même avant le premier domicile : le feu sert de point de départ. Les matériaux des outils sont réservés avant ceux du chantier ; les outils possédés sont réutilisés. Si les ingrédients de deux outils ne tiennent pas ensemble dans le sac, la préparation se fait outil par outil, au même coût. Sac entièrement plein, un dépôt accessible reçoit le surplus ; sans place ni dépôt, le villageois attend sans supprimer nourriture ou équipement. Un villageois sans arc utilisable ne demande pas de flèches. Un équipement volontairement rangé reste respecté. Le métal souhaité est conservé pour la prochaine casse. Pour les chantiers, priorité aux dépôts, puis collecte des matériaux nécessaires selon les cibles accessibles et l’équipement. Un marteau utilisable permet de ramasser, mais pas d’abattre un arbre ou de miner. Le transport et les matériaux sont comptés hors écran également. La préparation utilise une recherche locale par zones, vérifie les chemins et essaie une autre cible si la plus proche est inaccessible. Le temps restant sert à poursuivre le travail après fabrication ; les trajets partiels sont sauvegardés.</p>
${table(
  ['Outil de secours', 'Poste', 'Coût réel'],
  data.stoneToolRecipes.map(r => row([escape(r.item), escape(r.station), cost(r.cost)]))
)}
<h3>Contrôles exécutés</h3><p>Scènes synthétiques : chantier de 2 bois et 2 pierres, terrain plat, provisions déjà fournies, pas d’événement journalier ni de repas simulé. Les durées sont celles de ces scènes et ne prédisent pas celles d’une vraie carte.</p>
${table(
  ['Scénario', 'Récolté', 'Consommé', 'Objets restants', 'Contrôle'],
  data.checks.map(c =>
    row([escape(c.label), cost(c.gathered), cost(c.consumed), format(c.remainingNodes), c.passed ? 'OK' : 'ÉCHEC'])
  )
)}
<p class="muted">Miroir visuel à 50 % sur les ramassables et plantes autorisés, stable après chargement et sans incidence économique. Les icônes d’inventaire restent fixes.</p></section>`
}
module.exports = { groundResourceCatalogue, groundResourceSection }
