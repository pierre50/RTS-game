import { Assets } from 'pixi.js'
import { getIconPath, canAfford, refundCost } from '../lib'
import { appBottom } from '../constants'

export default class Menu {
  constructor(context) {
    this.context = context
    this.style = {
      bar: {
        borderStyle: 'inset',
        borderColor: '#686769',
        background: '#3c3b3d',
        width: '100%',
      },
      box: {
        height: '45px',
        width: '45px',
        position: 'relative',
        display: 'flex',
        marginRight: '3px',
      },
      img: {
        objectFit: 'none',
        height: '45px',
        width: '45px',
        border: '1.5px inset #686769',
        borderRadius: '2px',
      },
    }
    this.topbar = document.createElement('div')
    this.topbar.id = 'topbar'
    this.icons = {
      wood: 'interface/50732/000_50732.png',
      food: 'interface/50732/002_50732.png',
      stone: 'interface/50732/001_50732.png',
      gold: 'interface/50732/003_50732.png',
    }
    Object.assign(this.topbar.style, {
      top: '0',
      padding: '0 5px',
      height: '20px',
      display: 'grid',
      fontWeight: 'bold',
      gridTemplateColumns: '1fr 1fr 1fr',
      ...this.style.bar,
    })

    this.resources = document.createElement('div')
    Object.assign(this.resources.style, {
      display: 'flex',
    })
    ;['wood', 'food', 'stone', 'gold'].forEach(res => {
      this.setResourceBox(res)
    })

    this.age = document.createElement('div')
    Object.assign(this.age.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    })
    this.options = document.createElement('div')

    this.topbar.appendChild(this.resources)
    this.topbar.appendChild(this.age)
    this.topbar.appendChild(this.options)
    document.body.prepend(this.topbar)

    const bottombar = document.createElement('div')
    Object.assign(bottombar.style, {
      display: 'grid',
      height: '122px',
      gridTemplateColumns: '120px auto',
      gridGap: '10px',
      padding: '5px',
      marginBottom: '1px',
      ...this.style.bar,
    })
    this.bottombarInfo = document.createElement('div')
    Object.assign(this.bottombarInfo.style, {
      height: '114px',
      width: '120px',
      position: 'relative',
      border: '4px inset #686769',
      borderRadius: '2px',
    })
    this.bottombarMenu = document.createElement('div')
    this.bottombarMenu.style.display = 'flex'
    bottombar.appendChild(this.bottombarInfo)
    bottombar.appendChild(this.bottombarMenu)
    document.body.appendChild(bottombar)

    this.updateTopbar()
  }

  getMessage(cost) {
    const {
      context: { player },
    } = this
    const resource = Object.keys(cost).find(prop => player[prop] < cost[prop])
    return `You need more ${resource} !`
  }

  showMessage(message) {
    if (document.getElementById('msg')) {
      document.getElementById('msg').remove()
    }
    const box = document.createElement('div')
    box.id = 'msg'
    Object.assign(box.style, {
      zIndex: '1000',
      bottom: appBottom + 5 + 'px',
      position: 'fixed',
      width: '100%',
      textAlign: 'center',
    })
    const msg = document.createElement('span')
    msg.textContent = message
    Object.assign(msg.style, {
      color: '#DA2424',
      background: 'rgba(0,0,0,.4)',
      padding: '3px',
    })

    box.appendChild(msg)
    window.gamebox.appendChild(box)
    setTimeout(() => {
      box.remove()
    }, 3000)
  }

  setResourceBox(name) {
    const box = document.createElement('div')
    Object.assign(box.style, {
      display: 'flex',
      marginRight: '40px',
      alignItems: 'center',
    })
    const img = document.createElement('img')
    Object.assign(img.style, {
      objectFit: 'none',
      height: '13px',
      width: '20px',
      marginRight: '2px',
      border: '1.5px inset #686769',
      borderRadius: '2px',
    })
    img.src = this.icons[name]
    this[name] = document.createElement('div')
    box.appendChild(img)
    box.appendChild(this[name])
    this.resources.appendChild(box)
  }
  updateTopbar() {
    const {
      context: { player },
    } = this
    ;['wood', 'food', 'stone', 'gold', 'age'].forEach(prop => {
      this[prop].textContent = (player && player[prop]) || 0
    })
  }
  resetInfo() {
    this.bottombarInfo.textContent = ''
    this.bottombarInfo.style.background = 'transparent'
  }
  generateInfo(selection) {
    this.resetInfo()
    this.bottombarInfo.style.background = 'black'
    if (typeof selection.interface.info === 'function') {
      selection.interface.info(this.bottombarInfo)
    }
  }
  updateInfo(target, action) {
    const targetElement = this.bottombarInfo.querySelector(`[id=${target}]`)
    if (!targetElement || typeof action !== 'function') {
      return
    }
    return action(targetElement)
  }
  updateButtonContent(target, action) {
    const targetElement = this.bottombarMenu.querySelector(`[id=${target}]`)
    if (!targetElement || typeof action !== 'function') {
      return
    }
    const contentElement = targetElement.querySelector('[id=content]')
    if (!contentElement) {
      return
    }
    return action(contentElement)
  }
  toggleButtonCancel(target, value) {
    const element = this.bottombarMenu.querySelector(`[id=${target}-cancel]`)
    if (!element) {
      return
    }
    element.style.display = value ? 'block' : 'none'
  }
  setBottombar(selection = null) {
    const {
      context: { controls, player },
    } = this
    const me = this

    this.resetInfo()
    this.bottombarMenu.textContent = ''
    this.selection = selection
    if (controls.mouseBuilding) {
      controls.removeMouseBuilding()
    }
    if (selection && selection.interface) {
      this.generateInfo(selection)
      if (selection.name === 'building') {
        if (!selection.isBuilt) {
          setMenuRecurs(selection, this.bottombarMenu, [])
          return
        }
      }
      setMenuRecurs(selection, this.bottombarMenu, selection.interface.menu || [])
    }
    function setMenuRecurs(selection, element, menu, parent) {
      menu.forEach(btn => {
        const box = document.createElement('div')
        box.id = btn.id
        if (typeof btn.onCreate === 'function') {
          btn.onCreate(selection, box)
        } else {
          const img = document.createElement('img')
          img.src = btn.icon
          Object.assign(img.style, me.style.img)
          box.appendChild(img)
        }
        Object.assign(box.style, me.style.box)

        if (btn.children) {
          box.addEventListener('pointerdown', () => {
            element.textContent = ''
            controls.removeMouseBuilding()
            setMenuRecurs(selection, element, btn.children, menu)
          })
        } else if (typeof btn.onClick === 'function') {
          box.addEventListener('pointerdown', evt => btn.onClick(selection, evt))
        }
        element.appendChild(box)
      })
      if (parent || selection.selected) {
        const back = document.createElement('div')
        const img = document.createElement('img')
        back.id = 'interfaceBackBtn'
        img.src = 'interface/50721/010_50721.png'
        Object.assign(img.style, me.style.img)
        Object.assign(back.style, me.style.box)
        if (parent) {
          back.addEventListener('pointerdown', () => {
            element.textContent = ''
            controls.removeMouseBuilding()
            setMenuRecurs(selection, element, parent)
          })
        } else {
          back.addEventListener('pointerdown', () => {
            controls.removeMouseBuilding()
            player.unselectAll()
          })
        }
        back.appendChild(img)
        element.appendChild(back)
      }
    }
  }
  getUnitButton(type) {
    const {
      context: { player },
    } = this
    const unit = Assets.cache.get('config').units[type]
    return {
      icon: getIconPath(unit.icon),
      id: type,
      onCreate: (selection, element) => {
        const div = document.createElement('div')
        const cancel = document.createElement('img')
        cancel.id = `${type}-cancel`
        cancel.src = 'interface/50721/003_50721.png'
        if (!selection.queue.filter(q => q === type).length) {
          cancel.style.display = 'none'
        }
        cancel.addEventListener('pointerdown', () => {
          for (let i = 0; i < selection.queue.length; i++) {
            if (selection.queue[i] === type) {
              refundCost(player, unit.cost)
            }
          }
          this.updateTopbar()
          selection.queue = selection.queue.filter(q => q !== type)
          if (selection.queue[0] !== type) {
            this.updateButtonContent(type, element => (element.textContent = ''))
            this.toggleButtonCancel(type, false)
          }
        })
        Object.assign(cancel.style, this.style.img)
        const img = document.createElement('img')
        img.src = getIconPath(unit.icon)
        img.addEventListener('pointerdown', () => {
          if (canAfford(player, unit.cost)) {
            if (player.population >= player.populationMax) {
              this.showMessage('You need to build more houses')
            }
            this.toggleButtonCancel(type, true)
            selection.buyUnit(type)
          } else {
            this.showMessage(this.getMessage(unit.cost))
          }
        })
        Object.assign(img.style, this.style.img)
        const queue = selection.queue.filter(queue => queue === type).length
        const counter = document.createElement('div')
        counter.id = 'content'
        counter.style.padding = '1px'
        counter.textContent = queue || ''
        counter.style.position = 'absolute'
        div.appendChild(img)
        div.appendChild(cancel)
        element.appendChild(div)
        element.appendChild(counter)
      },
    }
  }

  getBuildingButton(type) {
    const {
      context: { controls, player },
    } = this
    const building = Assets.cache.get('config').buildings[player.civ][player.age][type]
    return {
      icon: getIconPath(building.icon),
      onClick: () => {
        controls.removeMouseBuilding()
        if (canAfford(player, building.cost)) {
          controls.setMouseBuilding({ ...building, type })
        } else {
          this.showMessage(this.getMessage(building.cost))
        }
      },
    }
  }
}
