import { Assets } from 'pixi.js'
import { sound } from '@pixi/sound'
import { getIconPath, canAfford, refundCost, isValidCondition, getBuildingAsset } from '../lib'
import { playClickSound } from '../lib/uiSound'
import { t } from '../lib/lang'
import { FAMILY_TYPES } from '../constants'

export class BottombarManager {
  constructor(menu) {
    this.menu = menu
  }

  resetInfo() {
    const { menu } = this
    menu.bottombarInfo.textContent = ''
    menu.bottombarInfo.classList.remove('active')
    menu._infoCache = null
  }

  generateInfo(selection) {
    const { menu } = this
    this.resetInfo()
    menu.bottombarInfo.classList.add('active')
    if (typeof selection.interface.info === 'function') {
      selection.interface.info(menu.bottombarInfo)
    }
  }

  updateInfo(target, action) {
    const { menu } = this
    if (!menu._infoCache) menu._infoCache = new Map()
    let targetElement = menu._infoCache.get(target)
    if (!targetElement) {
      targetElement = menu.bottombarInfo.querySelector(`.${target}`)
      if (!targetElement) return
      menu._infoCache.set(target, targetElement)
    }
    return typeof action !== 'function' ? (targetElement.textContent = action) : action(targetElement)
  }

  updateButtonContent(target, action) {
    const { menu } = this
    const targetElement = menu.bottombarMenu.querySelector(`[id=${target}]`)
    if (!targetElement) return
    const contentElement = targetElement.querySelector('.content')
    if (!contentElement) return
    return typeof action !== 'function' ? (contentElement.textContent = action) : action(contentElement)
  }

  toggleButtonCancel(target, value) {
    const { menu } = this
    const element = menu.bottombarMenu.querySelector(`[id=${target}-cancel]`)
    if (!element) return
    element.classList.toggle('hidden', !value)
  }

  playUiClick() {
    sound.play('5036')
  }

  clearMenuSelection() {
    this.menu.context.controls.removeMouseBuilding()
  }

  createMenuBox(id) {
    const box = document.createElement('div')
    box.className = 'bottombar-menu-box'
    box.id = id
    return box
  }

  createMenuIcon(src) {
    const img = document.createElement('img')
    img.src = src
    img.className = 'img'
    return img
  }

  createMenuButton(selection, btn, index, onNavigate) {
    const box = this.createMenuBox(btn.id || `btn-${index}`)
    if (typeof btn.onCreate === 'function') {
      btn.onCreate(selection, box)
    } else {
      box.appendChild(this.createMenuIcon(typeof btn.icon === 'function' ? btn.icon() : btn.icon))
    }

    if (btn.children) {
      box.addEventListener('pointerup', () => {
        this.playUiClick()
        onNavigate(btn.children)
      })
    } else if (typeof btn.onClick === 'function') {
      box.addEventListener('pointerup', evt => {
        this.playUiClick()
        btn.onClick(selection, evt)
      })
    }

    return box
  }

  renderBackButton(selection, element, parent) {
    const { player } = this.menu.context
    const back = this.createMenuBox('interfaceBackBtn')
    back.appendChild(this.createMenuIcon('assets/interface/50721/010_50721.png'))

    if (parent) {
      back.addEventListener('pointerup', () => {
        this.playUiClick()
        element.textContent = ''
        this.clearMenuSelection()
        this.renderMenuLevel(selection, element, parent)
      })
    } else {
      back.addEventListener('pointerup', () => {
        this.playUiClick()
        this.clearMenuSelection()
        player.unselectAll()
      })
    }

    element.appendChild(back)
  }

  renderMenuLevel(selection, element, items, parent) {
    items
      .filter(btn => !btn.hide || !btn.hide())
      .forEach((btn, index) => {
        element.appendChild(
          this.createMenuButton(selection, btn, index, children => {
            element.textContent = ''
            this.clearMenuSelection()
            this.renderMenuLevel(selection, element, children, items)
          })
        )
      })

    if (parent || selection.selected) {
      this.renderBackButton(selection, element, parent)
    }
  }

  getSelectionMenuItems(selection) {
    if (!selection?.interface) return []
    if (selection.family !== FAMILY_TYPES.building) return selection.interface.menu || []
    if (!selection.isBuilt) return []
    if (selection.technology) {
      return [
        {
          icon: 'assets/interface/50721/003_50721.png',
          id: `${selection.technology}-cancel`,
          onClick: sel => {
            sel.cancelTechnology()
          },
        },
      ]
    }
    return selection.interface.menu || []
  }

  updateBottombar() {
    const { menu } = this
    const { player } = menu.context
    if (player.selectedBuilding || player.selectedUnit) {
      this.setBottombar(player.selectedBuilding || player.selectedUnit)
    }
  }

  setBottombar(selection = null) {
    const { menu } = this
    const { context: { controls, player } } = menu

    this.resetInfo()
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

  getMessage(cost) {
    const { player } = this.menu.context
    const resource = Object.keys(cost).find(prop => player[prop] < cost[prop])
    return t('needMore', { resource: t(resource) })
  }

  getUnitButton(type) {
    const { menu } = this
    const { context: { player } } = menu
    const unit = player.config.units[type]
    return {
      id: type,
      icon: () => getIconPath(unit.icon),
      hide: () => (unit.conditions || []).some(condition => !isValidCondition(condition, player)),
      onCreate: (selection, element) => {
        const div = document.createElement('div')
        div.className = 'bottombar-menu-column'
        const cancel = this.createMenuIcon('assets/interface/50721/003_50721.png')
        cancel.id = `${type}-cancel`
        if (!selection.queue.some(q => q === type)) {
          cancel.classList.add('hidden')
        }
        cancel.addEventListener('pointerup', () => {
          this.playUiClick()
          for (let i = 0; i < selection.queue.length; i++) {
            if (selection.queue[i] === type) {
              refundCost(player, unit.cost)
            }
          }
          menu.updateTopbar()
          selection.queue = selection.queue.filter(q => q !== type)
          if (selection.queue[0] !== type) {
            this.updateButtonContent(type, '')
            this.toggleButtonCancel(type, false)
          }
        })
        const img = this.createMenuIcon(getIconPath(unit.icon))
        img.addEventListener('pointerup', () => {
          this.playUiClick()
          if (canAfford(player, unit.cost)) {
            if (player.population >= player.population_max) {
              menu.showMessage(t('needHouses'))
            }
            this.toggleButtonCancel(type, true)
            selection.buyUnit(type)
          } else {
            menu.showMessage(this.getMessage(unit.cost))
          }
        })
        const queue = selection.queue.filter(q => q === type).length
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

  getBuildingButton(type) {
    const { menu } = this
    const { context: { controls, player } } = menu
    const config = player.config.buildings[type]
    return {
      id: type,
      icon: () => {
        const assets = getBuildingAsset(type, player, Assets)
        return getIconPath(assets.icon)
      },
      hide: () => (config.conditions || []).some(condition => !isValidCondition(condition, player)),
      onClick: () => {
        const assets = getBuildingAsset(type, player, Assets)
        controls.removeMouseBuilding()
        if (canAfford(player, config.cost)) {
          controls.setMouseBuilding({ ...config, ...assets, type })
        } else {
          menu.showMessage(this.getMessage(config.cost))
        }
      },
    }
  }

  getTechnologyButton(type) {
    const { menu } = this
    const { context: { controls, player } } = menu
    const config = player.techs[type]
    return {
      icon: getIconPath(config.icon),
      id: type,
      hide: () =>
        (config.conditions || []).some(
          condition => player.technologies.includes(type) || !isValidCondition(condition, player)
        ),
      onClick: selection => {
        controls.removeMouseBuilding()
        if (canAfford(player, config.cost)) {
          selection.buyTechnology(type)
        } else {
          menu.showMessage(this.getMessage(config.cost))
        }
      },
    }
  }
}
