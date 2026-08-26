import { MinimapManager } from '../ui/minimap/MinimapManager'
import { TopbarView } from '../ui/TopbarView'
import { PauseMenu } from '../ui/PauseMenu'
import { MinimapInputController } from '../ui/minimap/MinimapInputController'
import { MenuTooltip } from '../ui/MenuTooltip'
import { InventoryManager } from '../ui/InventoryManager'
import { NpcOrdersManager } from '../ui/NpcOrdersManager'
import { HeroBuildingMenuManager } from '../ui/HeroBuildingMenuManager'
import { EntityInfoModalManager } from '../ui/EntityInfoModalManager'
import { HeroStatusHud } from '../ui/HeroStatusHud'
import { HeroInteractionPrompt } from '../ui/HeroInteractionPrompt'
import { MinimapView } from '../ui/minimap/MinimapView'
import { ActionMenuRenderer } from '../ui/ActionMenuRenderer'
import { ActionSpecFactory } from '../ui/ActionSpecFactory'
import { resetHeroCursor } from '../lib/hero/heroCursor'
import { playUiSound } from '../lib/audio/uiSound'
import { SOUND_CUES } from '../constants'
import type { GameContextLike, MenuLike, NpcOrdersOpenOptions } from '../types/context'
import type { BuildingEntity, ResourceEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import type { PlayerLike } from '../types/player'
import type { MinimapPlayerCanvas, MenuButtonSpec } from '../types/ui'
import type { ResourceAmount } from '../types/common'
import type { HeroEquippedItem } from '../lib/hero/heroTools'

// Repeated triggers of the same blocked action (e.g. holding a key against a failing condition)
// would otherwise re-show the same toast every frame — debounce so it only reappears once the
// previous one has faded.
const MESSAGE_REPEAT_DEBOUNCE_MS = 3000

export default class Menu implements MenuLike {
  context: GameContextLike
  gameHud: HTMLDivElement
  minimapView: MinimapView
  minimapWrap: HTMLDivElement
  minimapMap: HTMLDivElement
  terrainMinimap: HTMLCanvasElement
  playersMinimap: MinimapPlayerCanvas[]
  resourcesMinimap: HTMLCanvasElement
  cameraMinimap: HTMLCanvasElement
  minimapManager: MinimapManager
  actionSpecs: ActionSpecFactory
  actionRenderer: ActionMenuRenderer
  pauseMenu: PauseMenu
  topbarView: TopbarView
  minimapInputController: MinimapInputController
  menuTooltip: MenuTooltip
  inventoryManager: InventoryManager
  npcOrdersManager: NpcOrdersManager
  heroBuildingMenuManager: HeroBuildingMenuManager
  entityInfoModalManager: EntityInfoModalManager
  heroStatusHud: HeroStatusHud
  heroInteractionPrompt: HeroInteractionPrompt
  toggle?: HTMLButtonElement
  toggled: boolean
  icons!: Record<string, string>
  infoIcons!: Record<string, string>
  topbar!: HTMLDivElement
  topbarStatusStack!: HTMLDivElement
  resources!: HTMLDivElement
  age!: HTMLDivElement
  dayTime!: HTMLDivElement
  updatePlayerMiniMap: (owner: PlayerLike) => void
  updateResourcesMiniMap: () => void
  updateCameraMiniMap: () => void
  _infoCache: Map<string, HTMLElement> | null
  selection: RuntimeEntity | null
  private lastMessageText: string | null = null
  private lastMessageAt = 0

  constructor(context: GameContextLike) {
    this.context = context
    this.gameHud = document.createElement('div')
    this.gameHud.className = 'game-hud hidden'
    this.minimapView = new MinimapView(this)
    this.minimapWrap = this.minimapView.wrap
    this.minimapMap = this.minimapView.element
    this.terrainMinimap = this.minimapView.terrain
    this.playersMinimap = this.minimapView.players
    this.resourcesMinimap = this.minimapView.resources
    this.cameraMinimap = this.minimapView.camera
    document.body.appendChild(this.gameHud)

    this.minimapManager = new MinimapManager(this)
    this.actionSpecs = new ActionSpecFactory(this)
    this.actionRenderer = new ActionMenuRenderer(this)
    this.pauseMenu = new PauseMenu(this)
    this.topbarView = new TopbarView(this)
    this.minimapInputController = new MinimapInputController(this)
    this.menuTooltip = new MenuTooltip()
    this.inventoryManager = new InventoryManager(this)
    this.npcOrdersManager = new NpcOrdersManager(this)
    this.heroBuildingMenuManager = new HeroBuildingMenuManager(this)
    this.entityInfoModalManager = new EntityInfoModalManager(this)
    this.heroStatusHud = new HeroStatusHud(this)
    this.heroInteractionPrompt = new HeroInteractionPrompt(this.gameHud)
    this.toggled = false

    this.topbarView.build()
    this.minimapInputController.bind()

    // Expose throttled minimap updaters as top-level properties for external callers
    this.updatePlayerMiniMap = this.minimapManager.updatePlayerMiniMap
    this.updateResourcesMiniMap = this.minimapManager.updateResourcesMiniMap
    this.updateCameraMiniMap = this.minimapManager.updateCameraMiniMap

    this._infoCache = null
    this.selection = null
    this.updateTopbar()
  }

  destroy(): void {
    this.menuTooltip.destroy()
    this.minimapInputController.destroy()
    this.inventoryManager.destroy()
    this.npcOrdersManager.destroy()
    this.entityInfoModalManager.close()
    this.heroBuildingMenuManager.destroy()
    this.heroStatusHud.destroy()
    this.heroInteractionPrompt.destroy()
    this.minimapView.destroy()
    resetHeroCursor()
    this.gameHud.remove()
    this.topbarView.destroy()
  }

  init(): void {
    this.minimapManager.initMiniMap()
    this.updateTopbar()
    this.actionSpecs.preloadIcons(this.context.player)
  }

  show(): void {
    this.gameHud.classList.remove('hidden')
  }

  updateTopbar(): void {
    this.topbarView.update()
  }

  updateAgeTheme(): void {
    this.topbarView.updateAgeTheme()
  }

  showMessage(message: string, type = 'error'): void {
    const now = performance.now()
    if (message === this.lastMessageText && now - this.lastMessageAt < MESSAGE_REPEAT_DEBOUNCE_MS) return
    this.lastMessageText = message
    this.lastMessageAt = now

    const {
      context: { gamebox },
    } = this
    if (document.getElementById('msg')) {
      document.getElementById('msg')?.remove()
    }
    const box = document.createElement('div')
    box.id = 'msg'
    box.className = 'message'
    const msg = document.createElement('span')
    msg.textContent = message
    msg.className = `message-content message-content--${type}`

    box.appendChild(msg)
    gamebox.appendChild(box)
    setTimeout(() => {
      box.remove()
    }, 3000)
  }

  // Minimap delegates
  getMinimapFactor(): number {
    return this.minimapManager.getMinimapFactor()
  }
  revealTerrainMinimap(): void {
    return this.minimapManager.revealTerrainMinimap()
  }
  rebuildTerrainMiniMapFromViews(): void {
    return this.minimapManager.rebuildTerrainMiniMapFromViews()
  }
  updateTerrainMiniMap(i: number, j: number): void {
    return this.minimapManager.updateTerrainMiniMap(i, j)
  }
  updateResourceMiniMap(resource: ResourceEntity): void {
    return this.minimapManager.updateResourceMiniMap(resource)
  }
  updatePlayerMiniMapEvt(owner: PlayerLike): void {
    return this.minimapManager.updatePlayerMiniMapEvt(owner)
  }
  updateResourcesMiniMapEvt(): void {
    return this.minimapManager.updateResourcesMiniMapEvt()
  }
  updateCameraMiniMapEvt(): void {
    return this.minimapManager.updateCameraMiniMapEvt()
  }

  // Legacy selection target surface kept as no-op compatibility while gameplay is ARPG-only.
  resetInfo(): void {
    this._infoCache = null
    this.actionRenderer.clearHotkeys()
  }
  generateInfo(selection: RuntimeEntity): void {
    this.selection = selection
  }
  updateInfo(target: string, action: string | number | ((element: HTMLElement) => void)): void {
    void target
    void action
    this.entityInfoModalManager.syncLiveState()
    this.heroBuildingMenuManager.syncLiveState()
  }
  updateButtonContent(target: string, action: string | ((element: HTMLElement) => void)): void {
    void target
    void action
  }
  toggleQueuedActionCancel(target: string, value: boolean): void {
    void target
    void value
  }
  updateActionTarget(): void {
    const { controls, player } = this.context
    this.selection = controls.heroUnit ?? player.selectedBuilding ?? player.selectedUnit ?? null
    this.actionRenderer.clearHotkeys()
  }
  setActionTarget(selection?: RuntimeEntity | null): void {
    this.selection = selection ?? null
    this.actionRenderer.clearHotkeys()
  }
  setHeroInteractionPrompt(actionKey?: string | null): void {
    this.heroInteractionPrompt.setAction(actionKey)
  }
  getMessage(cost: ResourceAmount): string {
    return this.actionSpecs.getMessage(cost)
  }
  getActionUnitButton(type: string, building?: BuildingEntity): MenuButtonSpec {
    return this.actionSpecs.getActionUnitButton(type, building)
  }
  getActionRallyPointButton(): MenuButtonSpec {
    return this.actionSpecs.getActionRallyPointButton()
  }
  getActionBuildingButton(type: string, ownerOverride: PlayerLike | null = null): MenuButtonSpec {
    return this.actionSpecs.getActionBuildingButton(type, ownerOverride)
  }
  getActionTechnologyButton(type: string): MenuButtonSpec {
    return this.actionSpecs.getActionTechnologyButton(type)
  }
  getHeroTechnologyButtons(): MenuButtonSpec[] {
    return this.actionSpecs.getHeroTechnologyButtons()
  }
  getActionMenuItems(selection: RuntimeEntity): MenuButtonSpec[] {
    return this.actionSpecs.getActionMenuItems(selection)
  }
  createActionIcon(src: string): HTMLImageElement {
    return this.actionSpecs.createActionIcon(src)
  }
  playUiClick(): void {
    playUiSound(SOUND_CUES.ui.menuClick)
  }
  clearActionHotkeys(): void {
    return this.actionRenderer.clearHotkeys()
  }
  assignActionHotkey(id: string, usedKeys: Set<string>): string | null {
    return this.actionRenderer.assignHotkey(id, usedKeys)
  }
  createActionMenuButton(
    selection: RuntimeEntity,
    button: MenuButtonSpec,
    index: number,
    hotkey: string | null,
    onNavigate: (children: MenuButtonSpec[]) => void
  ): HTMLButtonElement {
    return this.actionRenderer.createMenuButton(selection, button, index, hotkey, onNavigate)
  }
  setActionHotkey(key: string, action: () => void): void {
    this.actionRenderer.activeHotkeys.set(key, action)
  }
  handleHotkey(key: string): void {
    return this.actionRenderer.handleHotkey(key)
  }

  // Inventory delegates
  toggleInventory(): void {
    return this.inventoryManager.toggle()
  }
  closeInventory(): void {
    return this.inventoryManager.close()
  }
  isInventoryOpen(): boolean {
    return this.inventoryManager.isOpen()
  }
  refreshInventory(): void {
    return this.inventoryManager.refresh()
  }
  setEquippedItem(item: HeroEquippedItem | null): void {
    return this.inventoryManager.render(item)
  }
  syncTechnologyProgress(): void {
    return this.inventoryManager.syncTechnologyProgress()
  }
  setEquippedTool(tool: HeroEquippedItem | null): void {
    return this.setEquippedItem(tool)
  }
  setHeroStatusTarget(hero: UnitEntity | null): void {
    return this.heroStatusHud.setHero(hero)
  }
  updateHeroStatus(hero?: UnitEntity | null): void {
    return this.heroStatusHud.update(hero)
  }

  // NPC orders delegates
  toggleNpcOrders(npcs: UnitEntity[]): void {
    return this.npcOrdersManager.toggle(npcs)
  }
  openNpcOrders(npcs: UnitEntity[], options?: NpcOrdersOpenOptions): void {
    return this.npcOrdersManager.open(npcs, options)
  }
  isNpcOrdersOpen(): boolean {
    return this.npcOrdersManager.isOpen()
  }
  closeNpcOrders(): void {
    return this.npcOrdersManager.close()
  }
  getNpcOrdersTarget(): UnitEntity[] {
    return this.npcOrdersManager.getTarget()
  }

  // hero building menu delegates
  openHeroBuildingMenu(building: BuildingEntity): boolean {
    return this.heroBuildingMenuManager.open(building)
  }
  openEntityInfoModal(entity: RuntimeEntity): boolean {
    return this.entityInfoModalManager.open(entity)
  }
  isEntityInfoModalOpen(): boolean {
    return this.entityInfoModalManager.isOpen()
  }
  closeEntityInfoModal(): void {
    return this.entityInfoModalManager.close()
  }
  syncEntityInfoModal(): void {
    return this.entityInfoModalManager.syncLiveState()
  }
  isHeroBuildingMenuOpen(): boolean {
    return this.heroBuildingMenuManager.isOpen()
  }
  closeHeroBuildingMenu(): void {
    return this.heroBuildingMenuManager.close()
  }
  getHeroBuildingMenuTarget(): BuildingEntity | null {
    return this.heroBuildingMenuManager.getTarget()
  }
  refreshHeroBuildingMenu(): void {
    return this.heroBuildingMenuManager.refresh()
  }
  syncHeroBuildingMenu(): void {
    return this.heroBuildingMenuManager.syncLiveState()
  }
}
