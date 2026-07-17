import { MinimapManager } from '../ui/MinimapManager'
import { BottombarManager } from '../ui/BottombarManager'
import { PlayerStatsManager } from '../ui/PlayerStatsManager'
import { TopbarView } from '../ui/TopbarView'
import { PauseMenu } from '../ui/PauseMenu'
import { MinimapInputController } from '../ui/MinimapInputController'
import { MenuTooltip } from '../ui/MenuTooltip'
import { InventoryManager } from '../ui/InventoryManager'
import type { GameContextLike, MenuLike } from '../types/context'
import type { ResourceEntity, RuntimeEntity } from '../types/entities'
import type { PlayerLike } from '../types/player'
import type { MinimapPlayerCanvas, MenuButtonSpec } from '../types/ui'
import type { ResourceAmount } from '../types/common'
import type { HeroTool } from '../lib/heroTools'

export default class Menu implements MenuLike {
  context: GameContextLike
  gameHud: HTMLDivElement
  bottombar: HTMLDivElement
  bottombarInfo: HTMLDivElement
  bottombarMenu: HTMLDivElement
  bottombarMap: HTMLDivElement
  terrainMinimap: HTMLCanvasElement
  playersMinimap: MinimapPlayerCanvas[]
  resourcesMinimap: HTMLCanvasElement
  cameraMinimap: HTMLCanvasElement
  minimapManager: MinimapManager
  bottombarManager: BottombarManager
  playerStatsManager: PlayerStatsManager
  pauseMenu: PauseMenu
  topbarView: TopbarView
  minimapInputController: MinimapInputController
  menuTooltip: MenuTooltip
  inventoryManager: InventoryManager
  toggle?: HTMLButtonElement
  toggled: boolean
  icons!: Record<string, string>
  infoIcons!: Record<string, string>
  topbar!: HTMLDivElement
  resources!: HTMLDivElement
  age!: HTMLDivElement
  updatePlayerMiniMap: (owner: PlayerLike) => void
  updateResourcesMiniMap: () => void
  updateCameraMiniMap: () => void
  _infoCache: Map<string, HTMLElement> | null
  selection: RuntimeEntity | null

  constructor(context: GameContextLike) {
    this.context = context
    this.gameHud = document.createElement('div')
    this.gameHud.className = 'game-hud'
    this.bottombar = document.createElement('div')
    this.bottombar.className = 'bottombar bar'
    this.bottombarInfo = document.createElement('div')
    this.bottombarInfo.className = 'bottombar-info'
    this.bottombarMenu = document.createElement('div')
    this.bottombarMenu.className = 'bottombar-menu'
    const bottombarMapWrap = document.createElement('div')
    bottombarMapWrap.className = 'bottombar-map-wrap'
    this.bottombarMap = document.createElement('div')
    this.bottombarMap.className = 'bottombar-map'
    bottombarMapWrap.appendChild(this.bottombarMap)

    this.terrainMinimap = document.createElement('canvas')
    this.playersMinimap = []
    this.resourcesMinimap = document.createElement('canvas')
    this.cameraMinimap = document.createElement('canvas')
    this.cameraMinimap.classList.add('minimap-camera')

    this.bottombarMap.appendChild(this.terrainMinimap)
    this.bottombarMap.appendChild(this.resourcesMinimap)
    this.bottombarMap.appendChild(this.cameraMinimap)
    this.bottombar.appendChild(this.bottombarInfo)
    this.bottombar.appendChild(this.bottombarMenu)
    this.bottombar.appendChild(bottombarMapWrap)
    this.gameHud.appendChild(this.bottombar)
    document.body.appendChild(this.gameHud)

    this.minimapManager = new MinimapManager(this)
    this.bottombarManager = new BottombarManager(this)
    this.playerStatsManager = new PlayerStatsManager(this)
    this.pauseMenu = new PauseMenu(this)
    this.topbarView = new TopbarView(this)
    this.minimapInputController = new MinimapInputController(this)
    this.menuTooltip = new MenuTooltip()
    this.inventoryManager = new InventoryManager(this)
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
    this.playerStatsManager.destroy()
    this.inventoryManager.destroy()
    this.gameHud.remove()
    this.topbarView.destroy()
  }

  init(): void {
    this.minimapManager.initMiniMap()
    this.updateTopbar()
    this.bottombarManager.preloadIcons(this.context.player)
  }

  updateTopbar(): void {
    this.topbarView.update()
  }

  updateAgeTheme(age = 0): void {
    this.topbarView.updateAgeTheme(age)
  }

  showMessage(message: string, type = 'error'): void {
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

  // PlayerStats delegate
  updatePlayerStats(): void {
    return this.playerStatsManager.update()
  }

  // Bottombar delegates
  resetInfo(): void {
    return this.bottombarManager.resetInfo()
  }
  generateInfo(selection: RuntimeEntity): void {
    return this.bottombarManager.generateInfo(selection)
  }
  updateInfo(target: string, action: string | number | ((element: HTMLElement) => void)): void {
    this.bottombarManager.updateInfo(target, action)
  }
  updateButtonContent(target: string, action: string | ((element: HTMLElement) => void)): void {
    this.bottombarManager.updateButtonContent(target, action)
  }
  toggleButtonCancel(target: string, value: boolean): void {
    return this.bottombarManager.toggleButtonCancel(target, value)
  }
  updateBottombar(): void {
    return this.bottombarManager.updateBottombar()
  }
  setBottombar(selection?: RuntimeEntity | null): void {
    return this.bottombarManager.setBottombar(selection)
  }
  getMessage(cost: ResourceAmount): string {
    return this.bottombarManager.getMessage(cost)
  }
  getUnitButton(type: string): MenuButtonSpec {
    return this.bottombarManager.getUnitButton(type)
  }
  getRallyPointButton(): MenuButtonSpec {
    return this.bottombarManager.getRallyPointButton()
  }
  getBuildingButton(type: string, ownerOverride: PlayerLike | null = null): MenuButtonSpec {
    return this.bottombarManager.getBuildingButton(type, ownerOverride)
  }
  getTechnologyButton(type: string): MenuButtonSpec {
    return this.bottombarManager.getTechnologyButton(type)
  }
  handleHotkey(key: string): void {
    return this.bottombarManager.handleHotkey(key)
  }

  // Inventory delegates
  toggleInventory(): void {
    return this.inventoryManager.toggle()
  }
  isInventoryOpen(): boolean {
    return this.inventoryManager.isOpen()
  }
  setEquippedTool(tool: HeroTool | null): void {
    return this.inventoryManager.render(tool)
  }
}
