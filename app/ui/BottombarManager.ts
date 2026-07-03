import { Assets } from 'pixi.js'
import { getIconPath, canAfford, isValidCondition, getBuildingAsset } from '../lib'
import { t } from '../lib/lang'
import { BUILDING_TYPES, FAMILY_TYPES, SOUND_CUES } from '../constants'
import { getWallIcon } from '../lib/buildings/walls'
import { getTowerType } from '../lib/buildings/towers'
import { syncHitPointsInfo } from './BaseEntityInterface'
import { playUiSound } from '../lib/uiSound'

type AnyRecord = Record<string, any>

export class BottombarManager {
  menu: AnyRecord
  activeHotkeys: Map<string, () => void>

  constructor(menu: AnyRecord) {
    this.menu = menu
    this.activeHotkeys = new Map()
  }

  assignHotkey(id: string, usedKeys: Set<string>): string | null {
    for (const ch of id.toLowerCase()) {
      if (/[a-z]/.test(ch) && !usedKeys.has(ch)) {
        usedKeys.add(ch)
        return ch
      }
    }
    return null
  }

  handleHotkey(key: string): void {
    const action = this.activeHotkeys.get(key)
    if (action) action()
  }

  resetInfo(): void {
    const { menu } = this
    menu.bottombarInfo.textContent = ''
    menu.bottombarInfo.classList.remove('active')
    menu._infoCache = null
    this.activeHotkeys.clear()
  }

  generateInfo(selection: AnyRecord): void {
    const { menu } = this
    this.resetInfo()
    menu.bottombarInfo.classList.add('active')
    if (typeof selection.interface.info === 'function') {
      selection.interface.info(menu.bottombarInfo)
    }
  }

  updateInfo(target: string, action: any): any {
    const { menu } = this
    if (!menu._infoCache) menu._infoCache = new Map()
    let targetElement = menu._infoCache.get(target)
    if (!targetElement) {
      targetElement = menu.bottombarInfo.querySelector(`.${target}`)
      if (!targetElement) return
      menu._infoCache.set(target, targetElement)
    }
    if (typeof action !== 'function') {
      if (target === 'hit-points') {
        return syncHitPointsInfo(targetElement, action)
      }
      targetElement.textContent = action
      return action
    }
    return action(targetElement)
  }

  updateButtonContent(target: string, action: any): any {
    const { menu } = this
    const targetElement = menu.bottombarMenu.querySelector(`[id=${target}]`)
    if (!targetElement) return
    const contentElement = targetElement.querySelector('.content')
    if (!contentElement) return
    return typeof action !== 'function' ? (contentElement.textContent = action) : action(contentElement)
  }

  toggleButtonCancel(target: string, value: boolean): void {
    const { menu } = this
    const element = menu.bottombarMenu.querySelector(`[id=${target}-cancel]`)
    if (!element) return
    element.classList.toggle('hidden', !value)
  }

  playUiClick(): void {
    playUiSound(SOUND_CUES.ui.menuClick)
  }

  clearMenuSelection(): void {
    this.menu.context.controls.removeMouseBuilding()
  }

  createMenuBox(id: string): HTMLDivElement {
    const box = document.createElement('div')
    box.className = 'bottombar-menu-box'
    box.id = id
    return box
  }

  createMenuIcon(src: string): HTMLImageElement {
    const img = document.createElement('img')
    img.src = src
    img.className = 'img'
    img.alt = ''
    return img
  }

  makePressable(element: HTMLElement, action: (evt: Event) => void): void {
    element.setAttribute('role', 'button')
    element.tabIndex = 0
    element.addEventListener('pointerup', evt => {
      this.menu.menuTooltip.hide()
      action(evt)
    })
    element.addEventListener('keydown', (evt: KeyboardEvent) => {
      if (evt.key !== 'Enter' && evt.key !== ' ') return
      evt.preventDefault()
      this.menu.menuTooltip.hide()
      action(evt)
    })
  }

  createMenuButton(selection: AnyRecord, btn: AnyRecord, index: number, hotkey: string | null, onNavigate: (children: any) => void): HTMLDivElement {
    const box = this.createMenuBox(btn.id || `btn-${index}`)
    if (typeof btn.onCreate === 'function') {
      btn.onCreate(selection, box)
    } else {
      box.appendChild(this.createMenuIcon(typeof btn.icon === 'function' ? btn.icon() : btn.icon))
    }

    if (btn.tooltip) {
      this.menu.menuTooltip.bind(box, btn.tooltip)
    }

    if (!btn.onCreate) {
      if (btn.children) {
        this.makePressable(box, () => {
          this.playUiClick()
          onNavigate(btn.children)
        })
      } else if (typeof btn.onClick === 'function') {
        this.makePressable(box, evt => {
          this.playUiClick()
          btn.onClick(selection, evt)
        })
      }
    }

    return box
  }

  renderBackButton(selection: AnyRecord, element: HTMLElement, parent?: AnyRecord): void {
    const { player } = this.menu.context
    const back = this.createMenuBox('interfaceBackBtn')
    back.appendChild(this.createMenuIcon('assets/interface/50721/010_50721.png'))
    this.menu.menuTooltip.bind(back, () => ({
      title: t('back'),
      description: t('backMenuDescription'),
    }))

    if (parent) {
      this.makePressable(back, () => {
        this.playUiClick()
        element.textContent = ''
        this.clearMenuSelection()
        this.renderMenuLevel(selection, element, parent as any)
      })
    } else {
      this.makePressable(back, () => {
        this.playUiClick()
        this.clearMenuSelection()
        player.unselectAll()
      })
    }

    element.appendChild(back)
  }

  renderMenuLevel(selection: AnyRecord, element: HTMLElement, items: AnyRecord[], parent?: AnyRecord): void {
    this.activeHotkeys.clear()
    const usedKeys = new Set<string>()

    items
      .filter(btn => !btn.hide || !btn.hide())
      .forEach((btn, index) => {
        const hotkey = this.assignHotkey(btn.id || '', usedKeys)
        const onNavigate = (children: any) => {
          element.textContent = ''
          this.clearMenuSelection()
          this.renderMenuLevel(selection, element, children, items)
        }
        element.appendChild(this.createMenuButton(selection, btn, index, hotkey, onNavigate))

        if (hotkey) {
          if (btn.children) {
            this.activeHotkeys.set(hotkey, () => {
              this.playUiClick()
              onNavigate(btn.children)
            })
          } else if (typeof btn.onClick === 'function') {
            this.activeHotkeys.set(hotkey, () => {
              this.playUiClick()
              btn.onClick(selection, null)
            })
          }
        }
      })

    if (parent || selection.selected) {
      this.renderBackButton(selection, element, parent)
    }
  }

  getSelectionMenuItems(selection: AnyRecord): AnyRecord[] {
    if (!selection?.interface) return []
    if (selection.family !== FAMILY_TYPES.building) return selection.interface.menu || []
    if (!selection.isBuilt) return []
    if (selection.technology) {
      return [
        {
          icon: 'assets/interface/50721/003_50721.png',
          id: `${selection.technology}-cancel`,
          tooltip: () => ({
            title: t('cancel'),
            description: t('cancelTechnologyDescription'),
          }),
          onClick: (sel: AnyRecord) => {
            sel.cancelTechnology()
          },
        },
      ]
    }
    return selection.interface.menu || []
  }

  updateBottombar(): void {
    const { menu } = this
    const { player } = menu.context
    if (player.selectedBuilding || player.selectedUnit) {
      this.setBottombar(player.selectedBuilding || player.selectedUnit)
    }
  }

  preloadIcons(player: AnyRecord): void {
    const preload = (src: string) => {
      new Image().src = src
    }
    preload('assets/interface/50721/010_50721.png')
    preload('assets/interface/50721/001_50721.png')
    preload('assets/interface/50721/003_50721.png')
    preload('assets/interface/50721/002_50721.png')
    preload('assets/interface/50721/006_50721.png')
    ;['006_50731', '007_50731', '008_50731', '010_50731', '004_50731', '009_50731'].forEach(icon =>
      preload(getIconPath(icon))
    )
    Object.values(player.config.units).forEach((unit: any) => {
      if (unit.icon) preload(getIconPath(unit.icon))
    })
    Object.values(player.techs).forEach((config: any) => {
      if (config.icon) preload(getIconPath(config.icon))
    })
    Object.keys(player.config.buildings).forEach(type => {
      try {
        const asset = getBuildingAsset(type, player as any, Assets)
        if (asset?.icon) preload(getIconPath(asset.icon as string))
      } catch {}
    })
    const gameConfig = Assets.cache.get('config')
    Object.values(gameConfig.resources || {}).forEach((res: any) => {
      if (res.icon) preload(getIconPath(res.icon))
    })
    Object.values(gameConfig.animals || {}).forEach((animal: any) => {
      if (animal.icon) preload(getIconPath(animal.icon))
    })
  }

  setBottombar(selection: AnyRecord | null = null): void {
    const { menu } = this
    const {
      context: { controls, player },
    } = menu

    this.resetInfo()
    menu.menuTooltip.hide()
    menu.bottombarMenu.textContent = ''
    menu.selection = selection
    if (controls.mouseBuilding) {
      controls.removeMouseBuilding()
    }
    if (selection && selection.interface) {
      this.generateInfo(selection)
      this.renderMenuLevel(selection, menu.bottombarMenu, this.getSelectionMenuItems(selection))
    }
  }

  getMessage(cost: AnyRecord): string {
    const { player } = this.menu.context
    const resource = Object.keys(cost).find(prop => player[prop] < cost[prop])
    return t('needMore', { resource: t(resource as string) })
  }

  formatCost(cost: AnyRecord): string {
    return Object.entries(cost || {})
      .map(([resource, amount]) => `${amount} ${t(resource)}`)
      .join(', ')
  }

  getBuildingTooltip(type: string, owner: AnyRecord, config: AnyRecord): AnyRecord {
    const displayType = type === BUILDING_TYPES.watchTower ? getTowerType(owner as any) : type
    return {
      title: t(displayType),
      description: t(`${displayType}Description`),
      meta: [
        t('tooltipCost', { cost: this.formatCost(config.cost) }),
        t('tooltipBuildTime', { time: config.constructionTime }),
      ],
    }
  }

  getTechnologyTooltip(type: string, config: AnyRecord): AnyRecord {
    return {
      title: t(type),
      description: t(`${type}Description`),
      meta: [
        t('tooltipCost', { cost: this.formatCost(config.cost) }),
        t('tooltipResearchTime', { time: config.researchTime }),
      ],
    }
  }

  getUnitTooltip(type: string, config: AnyRecord): AnyRecord {
    return {
      title: t(type),
      description: t(`${type}Description`),
      meta: [
        t('tooltipCost', { cost: this.formatCost(config.cost) }),
        t('tooltipTrainTime', { time: config.trainingTime }),
      ],
    }
  }

  getUnitButton(type: string): AnyRecord {
    const { menu } = this
    const {
      context: { player },
    } = menu
    const unit = player.config.units[type]
    return {
      id: type,
      icon: () => getIconPath(unit.icon),
      tooltip: () => this.getUnitTooltip(type, unit),
      hide: () => (unit.conditions || []).some((condition: any) => !isValidCondition(condition, player)),
      onClick: (selection: AnyRecord) => {
        if (canAfford(player, unit.cost)) {
          if (player.population >= player.population_max) {
            menu.showMessage(t('needHouses'), 'warning')
            return
          }
          this.toggleButtonCancel(type, true)
          selection.buyUnit(type)
        } else {
          menu.showMessage(this.getMessage(unit.cost), 'warning')
        }
      },
      onCreate: (selection: AnyRecord, element: HTMLElement) => {
        const div = document.createElement('div')
        div.className = 'bottombar-menu-column'
        const cancel = this.createMenuIcon('assets/interface/50721/003_50721.png')
        cancel.id = `${type}-cancel`
        if (!selection.queue.some((q: any) => q === type)) {
          cancel.classList.add('hidden')
        }
        cancel.addEventListener('pointerup', () => {
          this.playUiClick()
          selection.cancelUnits(type)
        })
        const img = this.createMenuIcon(getIconPath(unit.icon))
        img.addEventListener('pointerup', () => {
          this.playUiClick()
          if (canAfford(player, unit.cost)) {
            if (player.population >= player.population_max) {
              menu.showMessage(t('needHouses'), 'warning')
              return
            }
            this.toggleButtonCancel(type, true)
            selection.buyUnit(type)
          } else {
            menu.showMessage(this.getMessage(unit.cost), 'warning')
          }
        })
        const queue = selection.queue.filter((q: any) => q === type).length
        const counter = document.createElement('div')
        counter.classList.add('content')
        counter.textContent = queue || ''
        div.appendChild(img)
        div.appendChild(cancel)
        element.appendChild(div)
        element.appendChild(counter)
      },
    }
  }

  getRallyPointButton(): AnyRecord {
    return {
      id: 'rallyPoint',
      icon: 'assets/interface/50721/006_50721.png',
      tooltip: () => ({
        title: t('rallyPoint'),
        description: t('rallyPointDescription'),
      }),
      onClick: (selection: AnyRecord) => {
        this.menu.context.controls.rallyPointController.start(selection)
      },
    }
  }

  getBuildingButton(type: string, ownerOverride: AnyRecord | null = null): AnyRecord {
    const { menu } = this
    const {
      context: { controls, player },
    } = menu
    const owner = ownerOverride || player
    const config = owner.config.buildings[type]
    return {
      id: type,
      tooltip: () => this.getBuildingTooltip(type, owner, config),
      icon: () => {
        const displayType = type === BUILDING_TYPES.watchTower ? getTowerType(owner as any) : type
        const assets = getBuildingAsset(displayType, owner as any, Assets)
        return getIconPath(
          type === BUILDING_TYPES.smallWall
            ? getWallIcon(owner as any, assets.icon as string)
            : (assets.icon as string)
        )
      },
      hide: () => !owner.isBuildingEligible(type),
      onClick: () => {
        const displayType = type === BUILDING_TYPES.watchTower ? getTowerType(owner as any) : type
        const assets = getBuildingAsset(displayType, owner as any, Assets)
        controls.removeMouseBuilding()
        if (canAfford(owner, config.cost)) {
          controls.setMouseBuilding({ ...config, ...assets, type })
        } else {
          menu.showMessage(this.getMessage(config.cost), 'warning')
        }
      },
    }
  }

  getTechnologyButton(type: string): AnyRecord {
    const { menu } = this
    const {
      context: { controls, player },
    } = menu
    const config = player.techs[type]
    return {
      icon: getIconPath(config.icon),
      id: type,
      tooltip: () => this.getTechnologyTooltip(type, config),
      hide: () =>
        (config.conditions || []).some(
          (condition: any) => player.technologies.includes(type) || !isValidCondition(condition, player)
        ),
      onClick: (selection: AnyRecord) => {
        controls.removeMouseBuilding()
        if (canAfford(player, config.cost)) {
          selection.buyTechnology(type)
        } else {
          menu.showMessage(this.getMessage(config.cost), 'warning')
        }
      },
    }
  }
}
