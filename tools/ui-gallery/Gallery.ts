import buildingDefinitions from '../../public/assets/data/gameplay/buildings.json'
/** Layout fixtures use production components and CSS, with disposable sample data.
 * Open /ui-gallery/ on a separate local server. No game context or save is loaded.
 */
import '../../app/styles.css'
import '../../app/styles/quests.css'
import { Modal } from '../../app/lib/ui/Modal'
import { createInventorySection } from '../../app/ui/inventory/InventorySection'
import { EntityInfoModalManager } from '../../app/ui/inspection/EntityInfoModalManager'
import { createInspectionModal } from '../../app/ui/inspection/InspectionPanel'
import { openSettingsModal } from '../../app/ui/modals/settingsPanel'
import { PauseMenu } from '../../app/ui/PauseMenu'
import { QuestJournalManager } from '../../app/ui/quests/QuestJournalManager'
import { createHeroTrainingBody } from '../../app/ui/hero-building/HeroTrainingBody'
import { setLang } from '../../app/lib/lang'
import { Application, Assets } from 'pixi.js'
import { getTextureByFrame } from '../../app/lib/graphics/textures'
import { getBuildingDisplayName } from '../../app/ui/utils/entityDisplayName'
import { createEntityAvatar } from '../../app/ui/inspection/EntityInfoContent'
import { createHeroBuildingContainerBody } from '../../app/ui/hero-building/HeroBuildingContainerBody'
import { ResourceInterface } from '../../app/ui/entity/ResourceInterface'
import { BuildingInterface } from '../../app/ui/entity/BuildingInterface'
import { HeroForgeBody } from '../../app/ui/hero-building/HeroForgeBody'
import { HeroCampfireBody } from '../../app/ui/hero-building/HeroCampfireBody'
import { createHeroMarketBody } from '../../app/ui/hero-building/HeroMarketBody'
import { createHeroDepotReservesBody } from '../../app/ui/hero-building/HeroDepotReservesBody'
import { UnitInventoryScreen } from '../../app/ui/inventory/UnitInventoryScreen'
import { AnimalInventoryScreen } from '../../app/ui/inventory/AnimalInventoryScreen'
import { InventoryManager } from '../../app/ui/InventoryManager'
import { createInventoryEquipmentRow } from '../../app/ui/inventory/InventoryItemRows'
import { UnitInterface } from '../../app/ui/entity/UnitInterface'
import { createHeroBuildingUpgrade } from '../../app/ui/hero-building/HeroBuildingUpgrade'
import { openSaveListModal } from '../../app/ui/modals/saveListModal'
import MapConfig from '../../app/screens/MapConfig'
const params = new URLSearchParams(location.search)
setLang(params.get('lang') === 'en' ? 'en' : 'fr')
const app = new Application()
await app.init({ width: 64, height: 64, preference: 'webgl' })
const player: any = {
  label: 'gallery-player',
  civ: 'alba',
  age: 0,
  isPlayed: true,
  units: [],
  buildings: [],
  config: { units: {}, buildings: {} },
}
const hero: any = {
  type: 'Hero',
  family: 'unit',
  name: 'Aline',
  label: 'gallery-hero',
  category: 'Infantry',
  i: 0,
  j: 0,
  owner: player,
  hitPoints: 85,
  totalHitPoints: 100,
  experience: {},
  inventory: {
    resources: { wood: 20, stone: 12, gold: 5, bronzeIngot: 3 },
    equipment: [
      'sword_bronze~condition:42',
      'sword_bronze~condition:42',
      'armor_leather~condition:30',
      'bow',
      'arrow_ceramic',
    ],
    activeWeapons: { melee: 'sword_copper~condition:65' },
  },
}
hero.interface = {
  info: (el: any, options: any) =>
    new UnitInterface(hero).setDefaultInterface(el, { weaponPower: 6, armor: 2 } as any, options),
}
for (const type of ['FireCamp', 'Chest', 'House', 'Forge', 'Market', 'Farm', 'CampTable', 'CampChair'])
  player.config.buildings[type] = structuredClone((buildingDefinitions as any)[type])
function building(type: string): any {
  return {
    context: host.context,
    type,
    label: 'gallery-' + type,
    family: 'building',
    isBuilt: true,
    i: 0,
    j: 1,
    size: 1,
    owner: player,
    hitPoints: 350,
    totalHitPoints: 350,
    inventory: { resources: { wood: 30 }, equipment: ['bow'] },
  }
}

// Load only the atlases needed by the review fixtures, using the game's aliases.
for (const [alias, src] of Object.entries({
  alba: 'assets/data/civilizations/alba.json',
  hellas: 'assets/data/civilizations/hellas.json',
  buildings: 'assets/graphics/structures/buildings/texture.json',
  'buildings/deco': 'assets/graphics/structures/decorations/texture.json',
  'resources/minerals': 'assets/graphics/resources/minerals/texture.json',
  'resources/wheat': 'assets/graphics/resources/wheat/texture.json',
  'gallery-hero': 'assets/graphics/units/hero/alba/male/texture.json',
})) {
  Assets.add({ alias, src })
  await Assets.load(alias)
}
hero.standingSheet = Assets.get('gallery-hero')
hero.sheetDirectionCounts = { standing: 3 }
const screens = [
  { id: '01-feu-de-camp', name: 'Feu de camp' },
  { id: '02-forge', name: 'Forge' },
  { id: '03-marche', name: 'Marché' },
  { id: '04-butin', name: 'Butin' },
  { id: '30-butin-animal', name: 'Butin animal' },
  { id: '05-coffre', name: 'Coffre' },
  { id: '06-inventaire', name: 'Menu I — Inventaire' },
  { id: '07-construction', name: 'Menu I — Construction' },
  { id: '08-mobilier', name: 'Menu I — Construction (intérieur)' },
  { id: '09-formation', name: 'Formation' },
  { id: '10-reserves', name: 'Réserves' },
  { id: '11-quetes', name: 'Quêtes' },
  { id: '12-dialogue', name: 'Dialogue / ordres' },
  { id: '14-fiche-du-heros', name: 'Menu I — Personnage' },
  { id: '16-fiche-de-batiment', name: 'Fiche de bâtiment' },
  { id: '17-carte', name: 'Menu I — Carte' },
  { id: '18-pause', name: 'Pause' },
  { id: '19-parametres', name: 'Paramètres' },
  { id: '20-parametres-graphiques', name: 'Paramètres graphiques' },
  { id: '21-commandes-clavier', name: 'Commandes clavier' },
  { id: '22-commandes-manette', name: 'Commandes manette' },
  { id: '23-amelioration', name: 'Amélioration du bâtiment' },
  { id: '31-chantier', name: 'Chantier en cours' },
  { id: '32-chantier-pause', name: 'Chantier en pause' },
  { id: '24-sauvegardes', name: 'Sauvegardes' },
  { id: '25-nouvelle-partie', name: 'Nouvelle partie' },
  { id: '26-erreur-de-sauvegarde', name: 'Erreur de sauvegarde' },
  { id: '27-fiche-de-ressource', name: 'Fiche de ressource' },
  { id: '29-formation-en-cours', name: 'Formation en cours' },
]
const names = screens.map(screen => screen.name)
const toolbar = document.createElement('nav')
toolbar.style.cssText =
  'position:fixed;left:0;top:0;right:0;z-index:999999;background:#10172c;padding:3px;display:flex;gap:5px;font:12px sans-serif;height:28px'
const picker = document.createElement('select')
picker.setAttribute('aria-label', 'Écran à vérifier')
for (const name of names) picker.add(new Option(name, name))
const report = document.createElement('output')
report.style.display = 'none'
report.id = 'review-report'
const audit = document.createElement('button')
audit.textContent = 'Vérifier les écrans'
const padButton = document.createElement('button')
padButton.textContent = 'Manette simulée'
toolbar.append(picker, padButton, audit, report)
document.body.appendChild(toolbar)
const hud = document.createElement('div')
document.body.appendChild(hud)
const simulated = {
  id: 'Xbox test controller',
  connected: true,
  mapping: 'standard',
  index: 0,
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
  timestamp: 0,
}
let padOn = false
Object.defineProperty(navigator, 'getGamepads', { value: () => (padOn ? [simulated] : []) })
padButton.onclick = () => {
  padOn = !padOn
  padButton.textContent = padOn ? 'Clavier' : 'Manette simulée'
}
for (const [name, index] of [
  ['↑', 12],
  ['↓', 13],
  ['←', 14],
  ['→', 15],
  ['A', 0],
  ['B', 1],
  ['X', 2],
  ['Y', 3],
  ['LB', 4],
  ['RB', 5],
] as const) {
  const button = document.createElement('button')
  button.textContent = name
  button.onclick = () => {
    padOn = true
    simulated.buttons[index].pressed = true
    setTimeout(() => {
      simulated.buttons[index].pressed = false
    }, 100)
  }
  toolbar.appendChild(button)
}
let modal: Modal | undefined
let cleanup: (() => void) | undefined
const host: any = {
  playUiClick() {},
  showMessage() {},
  updateTopbar() {},
  refreshInventory() {},
  closeHeroBuildingMenu() {},
  clearActionHotkeys() {},
  assignActionHotkey() {
    return ''
  },
  setActionHotkey() {},
  deactivateMiniMap() {},
  activateMiniMap() {},
  updateCameraMiniMap() {},
  updateActionTarget() {},
  getActionBuildingButton(type: string) {
    return { id: type, details: { title: type, description: 'Construction de démonstration' }, onClick() {} }
  },
  minimapWrap: document.createElement('div'),
  gameHud: hud,
  context: {
    app,
    player,
    paused: true,
    controls: { heroUnit: hero },
    save: async () => {},
    quit() {},
    getQuestJournal: () => null,
  },
}

function node(tag: string, cls: string, text = '') {
  const el = document.createElement(tag)
  el.className = cls
  el.textContent = text
  return el
}
function row(title: string, value?: string, transfer = false) {
  const equipment =
    [
      'bow',
      'arrow_copper',
      'healing_poultice',
      'round_shield_copper_slash',
      'sword_ceramic',
      'pickaxe_ceramic',
      'armor_leather',
      'cooked_meat',
      'bow_recurve',
    ][
      [
        'Arc',
        'Flèche en cuivre',
        'Bandage',
        'Bouclier en bois',
        'Épée en pierre',
        'Pioche',
        'Armure',
        'Viande grillée',
        'Fibres',
      ].indexOf(title)
    ] || 'bow'
  return createInventoryEquipmentRow(host.context, {
    id: 'fixture-' + equipment,
    title,
    equipment,
    count: equipment.startsWith('arrow') ? 20 : 1,
    value,
    className: value ? 'market-slot market-buy-slot' : '',
    trailingAction: { label: transfer ? 'Prendre' : 'Fabriquer', onAction: () => {} },
  }).element
}

function list(title: string, market = false, transfer = false) {
  return createInventorySection({
    title,
    presentation: market ? 'market' : transfer ? 'items' : 'recipes',
    gridClassName: 'inventory-section-list',
    renderItems: grid => {
      for (let i = 0; i < 9; i++)
        grid.appendChild(
          row(
            [
              'Arc',
              'Flèche en cuivre',
              'Bandage',
              'Bouclier en bois',
              'Épée en pierre',
              'Pioche',
              'Armure',
              'Viande grillée',
              'Fibres',
            ][i],
            market ? `${12 + i * 7} or/u` : undefined,
            transfer
          )
        )
    },
  })
}
function info(name: string) {
  const wrap = node('div', 'entity-info-wrapper')
  const body = node('div', 'entity-info-modal selection-info active')
  const buildingTypes: Record<string, string> = {
    Forge: 'Forge',
    'Feu de camp': 'FireCamp',
    Marché: 'Market',
    Coffre: 'Chest',
    'Fiche de bâtiment': 'House',
    Formation: 'Barracks',
    'Formation en cours': 'Barracks',
    Réserves: 'StoragePit',
  }
  if (buildingTypes[name]) {
    const entity = building(buildingTypes[name])
    new BuildingInterface(entity).setDefaultInterface(body, player.config.buildings[entity.type] || {}, {
      hideIdentity: true,
    })
  } else {
    new UnitInterface(hero).setDefaultInterface(body, { weaponPower: 6, armor: 2 } as any)
    const avatar = createEntityAvatar(app, hero)
    if (avatar) wrap.append(avatar)
  }
  wrap.append(body)
  return wrap
}

function showInventory(name: string): boolean {
  if (
    [
      'Menu I — Inventaire',
      'Menu I — Construction',
      'Menu I — Personnage',
      'Menu I — Carte',
      'Menu I — Construction (intérieur)',
    ].includes(name)
  ) {
    if (name === 'Menu I — Construction (intérieur)') {
      const interior = {
        id: 'gallery-interior',
        kind: 'interior',
        renderer: {},
        building: building('House'),
        grid: [],
        size: 0,
      }
      host.context.map = { grid: [], size: 0, spaces: new Map([[interior.id, interior]]) }
      hero.spaceId = interior.id
    }
    if (name === 'Menu I — Carte') {
      host.context.map = { grid: [], size: 0 }
      host.minimapWrap.className = 'minimap-wrap local-square'
      const map = node('div', 'minimap-map local-square')
      map.appendChild(node('p', 'construction-help', 'Aperçu hors monde : aucune carte de sauvegarde chargée.'))
      host.minimapWrap.replaceChildren(map)
    }
    const inventory = new InventoryManager(host)
    inventory.activeTab =
      name === 'Menu I — Inventaire'
        ? 'tools'
        : name === 'Menu I — Personnage'
          ? 'info'
          : name === 'Menu I — Carte'
            ? 'minimap'
            : 'construction'
    const expectedTab = inventory.activeTab
    inventory.open()
    if (expectedTab === 'info' || expectedTab === 'minimap')
      inventory.modalTabs.tabs.buttons.get(expectedTab)?.focus({ preventScroll: true })
    if (inventory.activeTab !== expectedTab) throw new Error(`Onglet inattendu pour ${name}`)
    modal = inventory.modal
    cleanup = () => {
      inventory.close()
      inventory.destroy()
    }
    return true
  }
  return false
}

function showQuests(name: string): boolean {
  if (name === 'Quêtes') {
    const state: any = {
      version: 1,
      quests: [
        {
          id: 'test',
          definitionId: 'neutral-resource-request',
          status: 'active',
          stageId: 'delivery',
          parameters: { resource: 'wood', quantity: 20, rewardGold: 5, recipientName: 'Aline' },
          owner: { name: 'Aline' },
          unread: false,
        },
      ],
      trackedQuestId: null,
    }
    host.context.getQuestJournal = () => state
    const journal = new QuestJournalManager(host)
    journal.toggle()
    cleanup = () => journal.destroy()
    return true
  }
  return false
}

function show(name: string) {
  cleanup?.()
  cleanup = undefined
  modal?.close()
  modal = undefined
  host.context.player = player
  host.context.map = undefined
  hero.spaceId = 'outside'
  for (let remaining = 0; document.querySelector('.modal') && remaining < 5; remaining++)
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  if (document.querySelector('.modal')) throw new Error('La fenêtre précédente ne se ferme pas')
  if (['Paramètres', 'Paramètres graphiques', 'Commandes clavier', 'Commandes manette'].includes(name)) {
    modal = openSettingsModal()
    const index = ['Paramètres', 'Paramètres graphiques', 'Commandes clavier', 'Commandes manette'].indexOf(name)
    ;(
      modal._panel?.querySelectorAll<HTMLButtonElement>('.settings-topbar .ui-tab')[index] ??
      modal._panel?.querySelectorAll<HTMLButtonElement>('.ui-tab')[index]
    )?.click()
    return
  }
  if (name === 'Butin' || name === 'Butin animal') {
    const screen =
      name === 'Butin'
        ? new UnitInventoryScreen(host, {
            ...hero,
            label: 'gallery-corpse',
            lootEquipment: ['bow', 'arrow_ceramic'],
            isDead: true,
            hitPoints: 0,
            inventory: { equipment: ['bow', 'arrow_ceramic'], resources: { wood: 5 } },
          })
        : new AnimalInventoryScreen(host, {
            type: 'Wolf',
            family: 'animal',
            label: 'gallery-wolf-corpse',
            isDead: true,
            hitPoints: 0,
            i: 0,
            j: 1,
            inventory: { resources: { meat: 5, leather: 2 } },
          } as any)
    modal = screen.open(() => {})
    return
  }
  if (name === 'Fiche de ressource') {
    const entity: any = {
      type: 'Stone',
      family: 'resource',
      quantity: 120,
      totalQuantity: 200,
      sprite: { texture: getTextureByFrame('resources/minerals', 3, Assets) },
    }
    entity.interface = {
      info: (target: HTMLElement, options: any) =>
        new ResourceInterface(entity).setDefaultInterface(target, {} as any, options),
    }
    const inspection = new EntityInfoModalManager(host)
    if (!inspection.open(entity)) throw new Error('Impossible d’ouvrir la fiche de ressource')
    modal = inspection.modal
    cleanup = () => inspection.close()
    return
  }
  if (name === 'Sauvegardes') {
    openSaveListModal({ onLoad() {} })
    return
  }
  if (name === 'Nouvelle partie') {
    const config = new MapConfig({ onPlay() {} })
    modal = config._modal
    return
  }
  if (name === 'Erreur de sauvegarde') {
    modal = new Modal({
      title: 'Sauvegarde invalide',
      content: node('p', '', 'Impossible de charger cette sauvegarde de démonstration.'),
    })
    return
  }
  if (showInventory(name)) return
  if (name === 'Chantier en cours' || name === 'Chantier en pause') {
    const site = building('House')
    site.isBuilt = false
    site.constructionWorkRequired = player.config.buildings.House.constructionWorkRequired
    site.constructionProgress = 0.4
    site.constructionPaused = name === 'Chantier en pause'
    site.constructionMaterials = {
      cost: player.config.buildings.House.cost,
      delivered: {},
      consumed: player.config.buildings.House.cost,
    }
    const body = node('div', 'entity-info-modal selection-info active')
    new BuildingInterface(site).renderInfo(body, player.config.buildings.House)
    modal = createInspectionModal({ title: name, content: body, size: 'small', onClose() {} })
    return
  }
  if (name === 'Amélioration du bâtiment') {
    const body = node('div', 'building-upgrade-sheet-content')
    const upgrade = createHeroBuildingUpgrade(host, building('Forge'), () => {})
    if (!upgrade) throw new Error('La fixture ne propose aucune amélioration')
    body.append(info('Forge'), upgrade)
    modal = createInspectionModal({
      title: 'Amélioration du bâtiment',
      content: body,
      panelClass: 'building-upgrade-sheet',
      size: 'small',
      onClose() {},
    })
    return
  }

  if (name === 'Pause') {
    new PauseMenu(host).open()
    return
  }
  if (showQuests(name)) return
  const content = node('div', 'interaction-panel-content')
  const information = node('div', 'interaction-information')
  const actions = node('div', 'interaction-actions')
  information.appendChild(info(name))
  content.append(information, actions)
  let classes = 'inventory-transfer-modal'
  if (['Feu de camp', 'Forge'].includes(name)) {
    const body = node('div', 'hero-building-menu-body')
    body.append(
      name === 'Forge'
        ? new HeroForgeBody(host, building('Forge')).craftPanel
        : new HeroCampfireBody(host, building('FireCamp')).craftPanel
    )
    actions.append(body)
    classes += ' crafting-workshop' + (name === 'Forge' ? ' forge-workshop' : '')
  } else if (name === 'Marché') {
    actions.append(createHeroMarketBody(building('Market'), host, () => show(name))!)
  } else if (name === 'Coffre') {
    actions.append(createHeroBuildingContainerBody(building('Chest'), host, () => show(name))!.element)
  } else if (name === 'Formation' || name === 'Formation en cours') {
    showTraining(name, actions)
  } else if (name === 'Réserves') {
    actions.append(createHeroDepotReservesBody(building('StoragePit'), host, () => show(name))!)
  } else if (name === 'Dialogue / ordres') {
    classes = 'npc-orders-panel'
    information.appendChild(
      node(
        'p',
        'npc-orders-chatter-line',
        'Les voyageurs arrivent blessés. Si tu trouves des herbes près de la rivière, rapporte-les-moi.'
      )
    )
    const choices = node('div', 'npc-orders-options')
    for (const label of ['Parlons des voyageurs blessés.', 'Me suivre', 'Rester ici', 'Voir le sac']) {
      const button = node('button', 'ui-btn', label)
      choices.append(button)
    }
    actions.append(choices)
    actions.append(node('button', 'ui-btn npc-orders-exit', 'Terminer la conversation'))
  }
  modal = createInspectionModal({
    title: name === 'Fiche de bâtiment' ? getBuildingDisplayName(building('House')) : name,
    content,
    panelClass: classes,
    size: ['Dialogue / ordres', 'Fiche de bâtiment'].includes(name) ? 'small' : 'large',
    onClose() {},
  })
  const select = modal._panel?.querySelector<HTMLElement>(
    '.inventory-action-row, .npc-orders-options button, .hero-training-choice'
  )
  select?.focus()
}
picker.onchange = () => show(picker.value)
audit.onclick = async () => {
  const results = []
  for (const name of names) {
    show(name)
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const panel = document.querySelector<HTMLElement>('.modal-panel')
    const footer = panel?.querySelector<HTMLElement>('.game-window-footer')
    const rect = footer?.getBoundingClientRect()
    results.push({
      name,
      footerVisible: !!rect && rect.bottom <= innerHeight + 1,
      overflow: panel ? panel.scrollWidth > panel.clientWidth + 2 : true,
    })
  }
  report.textContent = JSON.stringify(results)
  audit.textContent = results.every(r => r.footerVisible && !r.overflow)
    ? `${names.length}/${names.length} sans débordement`
    : 'Vérification : anomalies'
  show(picker.value)
}
if (params.has('capture')) {
  toolbar.style.display = 'none'
  const style = document.createElement('style')
  style.textContent =
    '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}body{background:#080b16!important}'
  document.head.append(style)
}
async function ready() {
  await document.fonts.ready
  await Promise.all(
    Array.from(document.images)
      .filter(img => img.src)
      .map(img => img.decode().catch(() => {}))
  )
  await new Promise(resolve => setTimeout(resolve, 800))
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const panel = document.querySelector<HTMLElement>('.modal-panel')
  if (!panel) throw new Error('Aucune fenêtre rendue')
  return { width: panel.offsetWidth, height: panel.offsetHeight, overflow: panel.scrollWidth > panel.clientWidth + 2 }
}
;(window as any).uiGallery = {
  screens,
  async show(id: string) {
    const screen = screens.find(s => s.id === id)
    if (!screen) throw new Error('Unknown screen ' + id)
    show(screen.name)
    return ready()
  },
}
show(names[0])

function showTraining(name: string, actions: HTMLElement): void {
  const owner: any = {
    label: 'test',
    units: [],
    buildings: [],
    config: { units: { Fantassin: { category: 'Infantry' } } },
  }
  const building: any = {
    type: 'Barracks',
    label: 'barracks',
    isBuilt: true,
    owner,
    units: ['Fantassin'],
    trainingRequests: [],
    trainingQueue: [],
  }
  if (name === 'Formation en cours') {
    building.context = { dayNight: { state: { day: 3, hour: 18, minute: 0 } } }
    building.trainingQueue = [
      { type: 'Fantassin', trainee: { label: 'trainee-1', name: 'Maël' }, loading: 50, trainingCompleteDay: 4 },
    ]
    building.trainingRequests = [{ type: 'Fantassin', traineeLabel: 'trainee-2' }, { type: 'Fantassin' }]
    owner.units = [{ label: 'trainee-2', name: 'Ewen' }]
  }
  owner.buildings = [building]
  host.context.player = owner
  actions.appendChild(createHeroTrainingBody(building, host, () => show(name))!)
}
