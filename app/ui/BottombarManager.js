import { Assets } from 'pixi.js'
import { getIconPath, canAfford, refundCost, isValidCondition, getBuildingAsset } from '../lib'
import { t } from '../lib/lang'
import { FAMILY_TYPES, SOUND_CUES } from '../constants'
import { syncHitPointsInfo } from './BaseEntityInterface'
import { playUiSound } from '../lib/uiSound'

export class BottombarManager {
  constructor(menu) {
    this.menu = menu
    this.activeHotkeys = new Map()
  }

  assignHotkey(id, usedKeys) {
    for (const ch of id.toLowerCase()) {
      if (/[a-z]/.test(ch) && !usedKeys.has(ch)) {
        usedKeys.add(ch)
        return ch
      }
    }
    return null
  }

  handleHotkey(key) {
    const action = this.activeHotkeys.get(key)
    if (action) action()
  }

  resetInfo() {
    const { menu } = this
    menu.bottombarInfo.textContent = ''
    menu.bottombarInfo.classList.remove('active')
    menu._infoCache = null
    this.activeHotkeys.clear()
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
    if (typeof action !== 'function') {
      if (target === 'hit-points') {
        return syncHitPointsInfo(targetElement, action)
      }
      targetElement.textContent = action
      return action
    }
    return action(targetElement)
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
    playUiSound(SOUND_CUES.ui.menuClick)
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
    img.alt = ''
    return img
  }

  makePressable(element, action) {
    element.setAttribute('role', 'button')
    element.tabIndex = 0
    element.addEventListener('pointerup', evt => {
      action(evt)
    })
    element.addEventListener('keydown', evt => {
      if (evt.key !== 'Enter' && evt.key !== ' ') return
      evt.preventDefault()
      action(evt)
    })
  }

  createMenuButton(selection, btn, index, hotkey, onNavigate) {
    const box = this.createMenuBox(btn.id || `btn-${index}`)
    if (typeof btn.onCreate === 'function') {
      btn.onCreate(selection, box)
    } else {
      box.appendChild(this.createMenuIcon(typeof btn.icon === 'function' ? btn.icon() : btn.icon))
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

  renderBackButton(selection, element, parent) {
    const { player } = this.menu.context
    const back = this.createMenuBox('interfaceBackBtn')
    back.appendChild(this.createMenuIcon('assets/interface/50721/010_50721.png'))

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

  renderMenuLevel(selection, element, items, parent) {
    this.activeHotkeys.clear()
    const usedKeys = new Set()

    items
      .filter(btn => !btn.hide || !btn.hide())
      .forEach((btn, index) => {
        const hotkey = this.assignHotkey(btn.id || '', usedKeys)
        const onNavigate = children => {
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

  preloadIcons(player) {
    const preload = src => {
      new Image().src = src
    }
    preload('assets/interface/50721/010_50721.png')
    preload('assets/interface/50721/003_50721.png')
    preload('assets/interface/50721/002_50721.png')
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
        if (asset?.icon) preload(getIconPath(asset.icon))
      } catch {}
    })
    const gameConfig = Assets.cache.get('config')
    Object.values(gameConfig.resources || {}).forEach(res => {
      if (res.icon) preload(getIconPath(res.icon))
    })
    Object.values(gameConfig.animals || {}).forEach(animal => {
      if (animal.icon) preload(getIconPath(animal.icon))
    })
  }

  setBottombar(selection = null) {
    const { menu } = this
    const {
      context: { controls, player },
    } = menu

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
    const {
      context: { player },
    } = menu
    const unit = player.config.units[type]
    return {
      id: type,
      icon: () => getIconPath(unit.icon),
      hide: () => (unit.conditions || []).some(condition => !isValidCondition(condition, player)),
      onClick: selection => {
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
              menu.showMessage(t('needHouses'), 'warning')
            }
            this.toggleButtonCancel(type, true)
            selection.buyUnit(type)
          } else {
            menu.showMessage(this.getMessage(unit.cost), 'warning')
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

  getBuildingButton(type, ownerOverride = null) {
    const { menu } = this
    const {
      context: { controls, player },
    } = menu
    const owner = ownerOverride || player
    const config = owner.config.buildings[type]
    return {
      id: type,
      icon: () => {
        const assets = getBuildingAsset(type, owner, Assets)
        return getIconPath(assets.icon)
      },
      hide: () => (config.conditions || []).some(condition => !isValidCondition(condition, owner)),
      onClick: () => {
        const assets = getBuildingAsset(type, owner, Assets)
        controls.removeMouseBuilding()
        if (canAfford(owner, config.cost)) {
          controls.setMouseBuilding({ ...config, ...assets, type })
        } else {
          menu.showMessage(this.getMessage(config.cost), 'warning')
        }
      },
    }
  }

  getTechnologyButton(type) {
    const { menu } = this
    const {
      context: { controls, player },
    } = menu
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
          menu.showMessage(this.getMessage(config.cost), 'warning')
        }
      },
    }
  }
}
