import { Assets } from 'pixi.js'
import { getIconPath, canAfford, isValidCondition, getBuildingAsset } from '../lib'
import { t } from '../lib/lang'
import { ARPG_RESERVED_HOTKEYS, BUILDING_TYPES, FAMILY_TYPES, SOUND_CUES } from '../constants'
import { getWallIcon, type WallOwner } from '../lib/buildings/walls'
import { getTowerType, type TowerOwner } from '../lib/buildings/towers'
import { syncHitPointsInfo } from './BaseEntityInterface'
import { playUiSound } from '../lib/uiSound'
import type Menu from '../classes/Menu'
import type { BuildingEntity, PlaceableBuildingConfig, RuntimeEntity } from '../types/entities'
import type { PlayerLike } from '../types/player'
import type { MenuButtonSpec, TooltipContent } from '../types/ui'
import type { BuildingConfig, TechnologyConfig, UnitConfig } from '../types/config'
import type { ResourceAmount } from '../types/common'
import type { LoadedGameConfig } from '../types/save'

function isBuildingEntity(selection: RuntimeEntity | null | undefined): selection is BuildingEntity {
  return selection?.family === FAMILY_TYPES.building
}

export class BottombarManager {
  menu: Menu
  activeHotkeys: Map<string, () => void>

  constructor(menu: Menu) {
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

  generateInfo(selection: RuntimeEntity): void {
    const { menu } = this
    this.resetInfo()
    menu.bottombarInfo.classList.add('active')
    if (typeof selection.interface?.info === 'function') {
      selection.interface.info(menu.bottombarInfo)
    }
  }

  updateInfo(target: string, action: string | number | ((element: HTMLElement) => void)): void {
    const { menu } = this
    if (!menu._infoCache) menu._infoCache = new Map()
    let targetElement = menu._infoCache.get(target)
    if (!targetElement) {
      const found = menu.bottombarInfo.querySelector<HTMLElement>(`.${target}`)
      if (!found) return
      targetElement = found
      menu._infoCache.set(target, targetElement)
    }
    if (typeof action !== 'function') {
      if (target === 'hit-points') {
        syncHitPointsInfo(targetElement, action)
        return
      }
      targetElement.textContent = String(action)
      return
    }
    action(targetElement)
    menu._infoCache = null
  }

  updateButtonContent(target: string, action: string | ((element: HTMLElement) => void)): void {
    const { menu } = this
    const targetElement = menu.bottombarMenu.querySelector(`[id=${target}]`)
    if (!targetElement) return
    const contentElement = targetElement.querySelector<HTMLElement>('.content')
    if (!contentElement) return
    if (typeof action !== 'function') {
      contentElement.textContent = action
    } else {
      action(contentElement)
    }
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

  createMenuButton(
    selection: RuntimeEntity,
    btn: MenuButtonSpec,
    index: number,
    hotkey: string | null,
    onNavigate: (children: MenuButtonSpec[]) => void
  ): HTMLDivElement {
    const box = this.createMenuBox(btn.id || `btn-${index}`)
    if (typeof btn.onCreate === 'function') {
      btn.onCreate(selection, box)
    } else {
      box.appendChild(this.createMenuIcon(typeof btn.icon === 'function' ? btn.icon() : (btn.icon ?? '')))
    }

    if (btn.tooltip) {
      this.menu.menuTooltip.bind(box, btn.tooltip)
    }

    if (!btn.onCreate) {
      const children = btn.children
      const onClick = btn.onClick
      if (children) {
        this.makePressable(box, () => {
          this.playUiClick()
          onNavigate(children)
        })
      } else if (typeof onClick === 'function') {
        this.makePressable(box, evt => {
          this.playUiClick()
          onClick(selection, evt)
        })
      }
    }

    return box
  }

  renderBackButton(selection: RuntimeEntity, element: HTMLElement, parent?: MenuButtonSpec[]): void {
    const { player } = this.menu.context
    const back = this.createMenuBox('interfaceBackBtn')
    back.appendChild(this.createMenuIcon(getIconPath('010_50721')))
    this.menu.menuTooltip.bind(back, () => ({
      title: t('back'),
      description: t('backMenuDescription'),
    }))

    if (parent) {
      this.makePressable(back, () => {
        this.playUiClick()
        element.textContent = ''
        this.clearMenuSelection()
        this.renderMenuLevel(selection, element, parent)
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

  renderMenuLevel(
    selection: RuntimeEntity,
    element: HTMLElement,
    items: MenuButtonSpec[],
    parent?: MenuButtonSpec[]
  ): void {
    this.activeHotkeys.clear()
    const usedKeys = new Set<string>(this.menu.context.map.arpgMode ? ARPG_RESERVED_HOTKEYS : [])

    items
      .filter(btn => !btn.hide || !btn.hide())
      .forEach((btn, index) => {
        const hotkey = this.assignHotkey(btn.id || '', usedKeys)
        const onNavigate = (children: MenuButtonSpec[]) => {
          element.textContent = ''
          this.clearMenuSelection()
          this.renderMenuLevel(selection, element, children, items)
        }
        element.appendChild(this.createMenuButton(selection, btn, index, hotkey, onNavigate))

        if (hotkey) {
          if (btn.children) {
            this.activeHotkeys.set(hotkey, () => {
              this.playUiClick()
              onNavigate(btn.children!)
            })
          } else if (typeof btn.onClick === 'function') {
            this.activeHotkeys.set(hotkey, () => {
              this.playUiClick()
              btn.onClick!(selection, null)
            })
          }
        }
      })

    if (parent || selection.selected) {
      this.renderBackButton(selection, element, parent)
    }
  }

  getSelectionMenuItems(selection: RuntimeEntity): MenuButtonSpec[] {
    if (!selection.interface) return []
    if (!isBuildingEntity(selection)) return selection.interface.menu || []
    const building = selection
    if (!building.isBuilt) return []
    if (building.technology) {
      return [
        {
          icon: getIconPath('003_50721'),
          id: `${building.technology}-cancel`,
          tooltip: () => ({
            title: t('cancel'),
            description: t('cancelTechnologyDescription'),
          }),
          onClick: (sel: RuntimeEntity) => {
            if (isBuildingEntity(sel)) sel.cancelTechnology?.()
          },
        },
      ]
    }
    return building.interface?.menu || []
  }

  updateBottombar(): void {
    const { menu } = this
    const { player } = menu.context
    if (player.selectedBuilding || player.selectedUnit) {
      this.setBottombar(player.selectedBuilding || player.selectedUnit)
    }
  }

  preloadIcons(player: PlayerLike): void {
    const preload = (src: string) => {
      new Image().src = src
    }
    preload(getIconPath('010_50721'))
    preload(getIconPath('001_50721'))
    preload(getIconPath('003_50721'))
    preload(getIconPath('002_50721'))
    preload(getIconPath('006_50721'))
    ;['006_50731', '007_50731', '008_50731', '010_50731', '004_50731', '009_50731'].forEach(icon =>
      preload(getIconPath(icon))
    )
    Object.values(player.config.units).forEach(unit => {
      if (unit.icon) preload(getIconPath(unit.icon))
    })
    Object.values(player.techs).forEach(config => {
      if (config.icon) preload(getIconPath(config.icon))
    })
    Object.keys(player.config.buildings).forEach(type => {
      try {
        const asset = getBuildingAsset(type, player, Assets)
        if (asset?.icon) preload(getIconPath(asset.icon as string))
      } catch {}
    })
    const gameConfig = Assets.cache.get('config') as LoadedGameConfig
    Object.values((gameConfig.resources || {}) as Record<string, { icon?: string }>).forEach(res => {
      if (res.icon) preload(getIconPath(res.icon))
    })
    Object.values((gameConfig.animals || {}) as Record<string, { icon?: string }>).forEach(animal => {
      if (animal.icon) preload(getIconPath(animal.icon))
    })
  }

  setBottombar(selection: RuntimeEntity | null = null): void {
    const { menu } = this
    const {
      context: { controls },
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

  getMessage(cost: ResourceAmount): string {
    const { player } = this.menu.context
    const resource = (Object.keys(cost) as (keyof ResourceAmount)[]).find(prop => player[prop] < (cost[prop] ?? 0))
    return t('needMore', { resource: t(resource as string) })
  }

  formatCost(cost?: ResourceAmount): string {
    return Object.entries(cost || {})
      .map(([resource, amount]) => `${amount} ${t(resource)}`)
      .join(', ')
  }

  getBuildingTooltip(type: string, owner: PlayerLike, config: BuildingConfig): TooltipContent {
    const displayType =
      type === BUILDING_TYPES.watchTower ? getTowerType(owner as TowerOwner) : type
    return {
      title: t(displayType),
      description: t(`${displayType}Description`),
      meta: [
        t('tooltipCost', { cost: this.formatCost(config.cost) }),
        t('tooltipBuildTime', { time: config.constructionTime ?? 0 }),
      ],
    }
  }

  getTechnologyTooltip(type: string, config: TechnologyConfig): TooltipContent {
    return {
      title: t(type),
      description: t(`${type}Description`),
      meta: [
        t('tooltipCost', { cost: this.formatCost(config.cost) }),
        t('tooltipResearchTime', { time: config.researchTime ?? 0 }),
      ],
    }
  }

  getUnitTooltip(type: string, config: UnitConfig): TooltipContent {
    return {
      title: t(type),
      description: t(`${type}Description`),
      meta: [
        t('tooltipCost', { cost: this.formatCost(config.cost) }),
        t('tooltipTrainTime', { time: config.trainingTime ?? 0 }),
      ],
    }
  }

  getUnitButton(type: string): MenuButtonSpec {
    const { menu } = this
    const {
      context: { player },
    } = menu
    const unit = player.config.units[type]
    return {
      id: type,
      icon: () => getIconPath(unit.icon),
      tooltip: () => this.getUnitTooltip(type, unit),
      hide: () => (unit.conditions || []).some(condition => !isValidCondition(condition, player)),
      onClick: (selection: RuntimeEntity) => {
        if (!isBuildingEntity(selection)) return
        if (canAfford(player, unit.cost)) {
          if (player.population >= player.populationMax) {
            menu.showMessage(t('needHouses'), 'warning')
            return
          }
          this.toggleButtonCancel(type, true)
          selection.buyUnit?.(type)
        } else {
          menu.showMessage(this.getMessage(unit.cost ?? {}), 'warning')
        }
      },
      onCreate: (selection: RuntimeEntity, element: HTMLElement) => {
        if (!isBuildingEntity(selection)) return
        const unitSelection = selection
        const div = document.createElement('div')
        div.className = 'bottombar-menu-column'
        const cancel = this.createMenuIcon(getIconPath('003_50721'))
        cancel.id = `${type}-cancel`
        if (!unitSelection.queue?.some(q => q === type)) {
          cancel.classList.add('hidden')
        }
        cancel.addEventListener('pointerup', () => {
          this.playUiClick()
          unitSelection.cancelUnits?.(type)
        })
        const img = this.createMenuIcon(getIconPath(unit.icon))
        img.addEventListener('pointerup', () => {
          this.playUiClick()
          if (canAfford(player, unit.cost)) {
            if (player.population >= player.populationMax) {
              menu.showMessage(t('needHouses'), 'warning')
              return
            }
            this.toggleButtonCancel(type, true)
            unitSelection.buyUnit?.(type)
          } else {
            menu.showMessage(this.getMessage(unit.cost ?? {}), 'warning')
          }
        })
        const queue = unitSelection.queue?.filter(q => q === type).length ?? 0
        const counter = document.createElement('div')
        counter.classList.add('content')
        counter.textContent = queue ? String(queue) : ''
        div.appendChild(img)
        div.appendChild(cancel)
        element.appendChild(div)
        element.appendChild(counter)
      },
    }
  }

  getRallyPointButton(): MenuButtonSpec {
    return {
      id: 'rallyPoint',
      icon: getIconPath('006_50721'),
      tooltip: () => ({
        title: t('rallyPoint'),
        description: t('rallyPointDescription'),
      }),
      onClick: (selection: RuntimeEntity) => {
        this.menu.context.controls.rallyPointController?.start(selection)
      },
    }
  }

  getBuildingButton(type: string, ownerOverride: PlayerLike | null = null): MenuButtonSpec {
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
        const displayType =
          type === BUILDING_TYPES.watchTower ? getTowerType(owner as TowerOwner) : type
        const assets = getBuildingAsset(displayType, owner, Assets)
        return getIconPath(
          type === BUILDING_TYPES.smallWall
            ? getWallIcon(owner as WallOwner, assets.icon as string)
            : (assets.icon as string)
        )
      },
      hide: () => !owner.isBuildingEligible?.(type),
      onClick: () => {
        const displayType =
          type === BUILDING_TYPES.watchTower ? getTowerType(owner as TowerOwner) : type
        const assets = getBuildingAsset(displayType, owner, Assets)
        controls.removeMouseBuilding()
        if (canAfford(owner, config.cost)) {
          const placeableBuilding: PlaceableBuildingConfig = { ...config, ...assets, type }
          controls.setMouseBuilding?.(placeableBuilding)
        } else {
          menu.showMessage(this.getMessage(config.cost ?? {}), 'warning')
        }
      },
    }
  }

  getTechnologyButton(type: string): MenuButtonSpec {
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
          condition => player.technologies.includes(type) || !isValidCondition(condition, player)
        ),
      onClick: (selection: RuntimeEntity) => {
        if (!isBuildingEntity(selection)) return
        controls.removeMouseBuilding()
        if (canAfford(player, config.cost)) {
          selection.buyTechnology?.(type)
        } else {
          menu.showMessage(this.getMessage(config.cost ?? {}), 'warning')
        }
      },
    }
  }
}
