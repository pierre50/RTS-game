import { getIconPath } from '../lib'
import { t } from '../lib/lang'
import { SOUND_CUES } from '../constants'
import { syncHitPointsInfo } from './BaseEntityInterface'
import { playUiSound } from '../lib/uiSound'
import type Menu from '../classes/Menu'
import type { RuntimeEntity } from '../types/entities'
import type { MenuButtonSpec } from '../types/ui'
import type { ActionMenuRenderer } from './ActionMenuRenderer'

export class BottombarManager {
  menu: Menu
  actionRenderer: ActionMenuRenderer

  constructor(menu: Menu) {
    this.menu = menu
    this.actionRenderer = menu.actionRenderer
  }

  handleHotkey(key: string): void {
    this.actionRenderer.handleHotkey(key)
  }

  resetInfo(): void {
    const { menu } = this
    menu.bottombarInfo.textContent = ''
    menu.bottombarInfo.classList.remove('active')
    menu._infoCache = null
    this.actionRenderer.clearHotkeys()
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

  toggleQueuedActionCancel(target: string, value: boolean): void {
    const element = this.menu.bottombarMenu.querySelector(`[id=${target}-cancel]`)
    if (!element) return
    element.classList.toggle('hidden', !value)
  }

  playUiClick(): void {
    playUiSound(SOUND_CUES.ui.menuClick)
  }

  clearBottombarPlacement(): void {
    this.menu.context.controls.removeMouseBuilding()
  }

  createBottombarBox(id: string): HTMLDivElement {
    return this.actionRenderer.createMenuBox(id)
  }

  createBottombarIcon(src: string): HTMLImageElement {
    return this.menu.createActionIcon(src)
  }

  makeBottombarPressable(element: HTMLElement, action: (evt: Event) => void): void {
    this.actionRenderer.makePressable(element, action)
  }

  createBottombarButton(
    selection: RuntimeEntity,
    btn: MenuButtonSpec,
    index: number,
    hotkey: string | null,
    onNavigate: (children: MenuButtonSpec[]) => void
  ): HTMLDivElement {
    return this.actionRenderer.createMenuButton(selection, btn, index, hotkey, onNavigate)
  }

  renderBottombarBackButton(selection: RuntimeEntity, element: HTMLElement, parent?: MenuButtonSpec[]): void {
    const { player } = this.menu.context
    const back = this.createBottombarBox('interfaceBackBtn')
    back.appendChild(this.createBottombarIcon(getIconPath('010_50721')))
    this.menu.menuTooltip.bind(back, () => ({
      title: t('back'),
      description: t('backMenuDescription'),
    }))

    if (parent) {
      this.makeBottombarPressable(back, () => {
        this.playUiClick()
        element.textContent = ''
        this.clearBottombarPlacement()
        this.renderBottombarMenuLevel(selection, element, parent)
      })
    } else {
      this.makeBottombarPressable(back, () => {
        this.playUiClick()
        this.clearBottombarPlacement()
        player.unselectAll()
      })
    }

    element.appendChild(back)
  }

  renderBottombarMenuLevel(
    selection: RuntimeEntity,
    element: HTMLElement,
    items: MenuButtonSpec[],
    parent?: MenuButtonSpec[]
  ): void {
    this.actionRenderer.renderMenuLevel(selection, element, items, {
      parent,
      onNavigate: (children: MenuButtonSpec[]) => {
        element.textContent = ''
        this.clearBottombarPlacement()
        this.renderBottombarMenuLevel(selection, element, children, items)
      },
    })
    if (parent || selection.selected) {
      this.renderBottombarBackButton(selection, element, parent)
    }
  }

  getBottombarMenuItems(selection: RuntimeEntity): MenuButtonSpec[] {
    return this.menu.getActionMenuItems(selection)
  }

  updateBottombar(): void {
    const { menu } = this
    const { controls, player } = menu.context
    if (controls.isHeroControlActive?.()) {
      this.setBottombar(controls.heroUnit ?? null)
      return
    }
    if (player.selectedBuilding || player.selectedUnit) {
      this.setBottombar(player.selectedBuilding || player.selectedUnit)
    }
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
    if (controls.isHeroControlActive?.()) {
      const hero = controls.heroUnit ?? selection
      menu.selection = hero ?? null
      return
    }
    if (selection && selection.interface) {
      this.generateInfo(selection)
      this.renderBottombarMenuLevel(selection, menu.bottombarMenu, this.getBottombarMenuItems(selection))
    }
  }

}
