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
    menu.bottombarInfo.style.background = 'transparent'
    menu._infoCache = null
  }

  generateInfo(selection) {
    const { menu } = this
    this.resetInfo()
    menu.bottombarInfo.style.background = 'black'
    if (typeof selection.interface.info === 'function') {
      selection.interface.info(menu.bottombarInfo)
    }
  }

  updateInfo(target, action) {
    const { menu } = this
    if (!menu._infoCache) menu._infoCache = new Map()
    let targetElement = menu._infoCache.get(target)
    if (!targetElement) {
      targetElement = menu.bottombarInfo.querySelector(`[id=${target}]`)
      if (!targetElement) return
      menu._infoCache.set(target, targetElement)
    }
    return typeof action !== 'function' ? (targetElement.textContent = action) : action(targetElement)
  }

  updateButtonContent(target, action) {
    const { menu } = this
    const targetElement = menu.bottombarMenu.querySelector(`[id=${target}]`)
    if (!targetElement) return
    const contentElement = targetElement.querySelector('[id=content]')
    if (!contentElement) return
    return typeof action !== 'function' ? (contentElement.textContent = action) : action(contentElement)
  }

  toggleButtonCancel(target, value) {
    const { menu } = this
    const element = menu.bottombarMenu.querySelector(`[id=${target}-cancel]`)
    if (!element) return
    element.style.display = value ? 'block' : 'none'
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
      if (selection.family === FAMILY_TYPES.building) {
        if (!selection.isBuilt) {
          setMenuRecurs(selection, menu.bottombarMenu, [])
        } else if (selection.technology) {
          setMenuRecurs(selection, menu.bottombarMenu, [
            {
              icon: 'assets/interface/50721/003_50721.png',
              id: `${selection.technology}-cancel`,
              onClick: sel => {
                sound.play('5036')
                sel.cancelTechnology()
              },
            },
          ])
        } else {
          setMenuRecurs(selection, menu.bottombarMenu, selection.interface.menu || [])
        }
      } else {
        setMenuRecurs(selection, menu.bottombarMenu, selection.interface.menu || [])
      }
    }

    function setMenuRecurs(sel, element, items, parent) {
      items
        .filter(btn => !btn.hide || !btn.hide())
        .forEach((btn, index) => {
          const box = document.createElement('div')
          box.className = 'bottombar-menu-box'
          box.id = btn.id || `btn-${index}`
          if (typeof btn.onCreate === 'function') {
            btn.onCreate(sel, box)
          } else {
            const img = document.createElement('img')
            img.src = typeof btn.icon === 'function' ? btn.icon() : btn.icon
            img.className = 'img'
            box.appendChild(img)
          }

          if (btn.children) {
            box.addEventListener('pointerup', () => {
              sound.play('5036')
              element.textContent = ''
              controls.removeMouseBuilding()
              setMenuRecurs(sel, element, btn.children, items)
            })
          } else if (typeof btn.onClick === 'function') {
            box.addEventListener('pointerup', evt => {
              sound.play('5036')
              btn.onClick(sel, evt)
            })
          }
          element.appendChild(box)
        })
      if (parent || sel.selected) {
        const back = document.createElement('div')
        back.className = 'bottombar-menu-box'
        const img = document.createElement('img')
        img.className = 'img'
        back.id = 'interfaceBackBtn'
        img.src = 'assets/interface/50721/010_50721.png'
        if (parent) {
          back.addEventListener('pointerup', () => {
            sound.play('5036')
            element.textContent = ''
            controls.removeMouseBuilding()
            setMenuRecurs(sel, element, parent)
          })
        } else {
          back.addEventListener('pointerup', () => {
            sound.play('5036')
            controls.removeMouseBuilding()
            player.unselectAll()
          })
        }
        back.appendChild(img)
        element.appendChild(back)
      }
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
        const cancel = document.createElement('img')
        cancel.id = `${type}-cancel`
        cancel.className = 'img'
        cancel.src = 'assets/interface/50721/003_50721.png'
        if (!selection.queue.some(q => q === type)) {
          cancel.style.display = 'none'
        }
        cancel.addEventListener('pointerup', () => {
          sound.play('5036')
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
        const img = document.createElement('img')
        img.src = getIconPath(unit.icon)
        img.className = 'img'
        img.addEventListener('pointerup', () => {
          sound.play('5036')
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
        counter.id = 'content'
        counter.textContent = queue || ''
        counter.style.padding = '1px'
        counter.style.position = 'absolute'
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
