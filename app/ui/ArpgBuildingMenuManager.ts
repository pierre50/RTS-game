import { FAMILY_TYPES, SOUND_CUES } from '../constants'
import { getBuildingContactDistance, instancesDistance } from '../lib'
import { t } from '../lib/lang'
import { playUiSound } from '../lib/uiSound'
import type Menu from '../classes/Menu'
import type { BuildingEntity } from '../types/entities'
import type { MenuButtonSpec } from '../types/ui'

function isBuildingEntity(value: unknown): value is BuildingEntity {
  return Boolean(value && (value as BuildingEntity).family === FAMILY_TYPES.building)
}

function buttonTitle(button: MenuButtonSpec): string {
  const tooltip = typeof button.tooltip === 'function' ? button.tooltip() : button.tooltip
  return tooltip?.title || (button.id ? t(button.id) : '')
}

function buttonMeta(button: MenuButtonSpec): string {
  const tooltip = typeof button.tooltip === 'function' ? button.tooltip() : button.tooltip
  return tooltip?.meta?.filter(Boolean).join(' | ') || tooltip?.description || ''
}

export class ArpgBuildingMenuManager {
  menu: Menu
  panel: HTMLDivElement
  header: HTMLDivElement
  title: HTMLDivElement
  info: HTMLDivElement
  body: HTMLDivElement
  backButton: HTMLButtonElement
  closeButton: HTMLButtonElement
  building: BuildingEntity | null
  stack: MenuButtonSpec[][]
  opened: boolean
  structureSignature: string
  onKeyDown: (evt: KeyboardEvent) => void

  constructor(menu: Menu) {
    this.menu = menu
    this.building = null
    this.stack = []
    this.opened = false
    this.structureSignature = ''
    this.onKeyDown = (evt: KeyboardEvent) => {
      if (!this.opened || evt.key !== 'Escape') return
      evt.preventDefault()
      this.close()
    }

    this.panel = document.createElement('div')
    this.panel.className = 'arpg-building-menu modal-panel ui-panel-enter hidden'
    this.panel.setAttribute('role', 'dialog')

    this.header = document.createElement('div')
    this.header.className = 'arpg-building-menu-header modal-header'

    this.backButton = document.createElement('button')
    this.backButton.type = 'button'
    this.backButton.className = 'arpg-building-menu-nav ui-btn'
    this.backButton.textContent = '<'
    this.backButton.addEventListener('click', () => this.back())

    this.title = document.createElement('div')
    this.title.className = 'arpg-building-menu-title modal-title'

    this.closeButton = document.createElement('button')
    this.closeButton.type = 'button'
    this.closeButton.className = 'arpg-building-menu-nav modal-close ui-btn'
    this.closeButton.textContent = '✕'
    this.closeButton.setAttribute('aria-label', t('close'))
    this.closeButton.addEventListener('click', () => this.close())

    this.body = document.createElement('div')
    this.body.className = 'arpg-building-menu-body'

    this.info = document.createElement('div')
    this.info.className = 'arpg-building-menu-info bottombar-info active'

    this.header.appendChild(this.backButton)
    this.header.appendChild(this.title)
    this.header.appendChild(this.closeButton)
    this.panel.appendChild(this.header)
    this.panel.appendChild(this.info)
    this.panel.appendChild(this.body)
    this.menu.gameHud.appendChild(this.panel)
  }

  canOpenFor(building: BuildingEntity | null | undefined): building is BuildingEntity {
    const hero = this.menu.context.controls.heroUnit
    const player = this.menu.context.player
    if (!hero || !building || building.isDestroyed || building.isDead || !building.isBuilt) return false
    if (building.owner !== player || !building.owner?.isPlayed) return false
    const allowedDistance = getBuildingContactDistance(building.size ?? 1) + 1
    return Math.floor(instancesDistance(hero, building)) <= allowedDistance
  }

  open(building: BuildingEntity): boolean {
    if (!this.canOpenFor(building)) return false
    const items = this.menu.getActionMenuItems(building)
    this.building = building
    this.stack = [items]
    this.opened = true
    this.structureSignature = this.getStructureSignature()
    document.addEventListener('keydown', this.onKeyDown)
    this.title.textContent = t(building.assetType || building.type)
    this.panel.classList.remove('hidden')
    this.render()
    return true
  }

  close(): void {
    document.removeEventListener('keydown', this.onKeyDown)
    this.menu.menuTooltip.hide()
    const building = this.building
    this.building = null
    this.stack = []
    this.opened = false
    this.structureSignature = ''
    this.panel.classList.add('hidden')
    this.info.textContent = ''
    this.body.textContent = ''
    const player = this.menu.context.player
    if (building && player?.selectedBuilding === building) {
      building.unselect?.()
      player.selectedBuilding = null
    }
  }

  back(): void {
    if (this.stack.length <= 1) {
      this.close()
      return
    }
    this.stack.pop()
    this.render()
  }

  refresh(): void {
    if (!this.opened || !this.building) return
    if (!this.canOpenFor(this.building)) {
      this.close()
      return
    }
    this.stack[0] = this.menu.getActionMenuItems(this.building)
    this.structureSignature = this.getStructureSignature()
    this.render()
  }

  closeIfInvalid(): void {
    if (this.opened && !this.canOpenFor(this.building)) this.close()
  }

  syncLiveState(): void {
    if (!this.opened || !this.building) return
    if (!this.canOpenFor(this.building)) {
      this.close()
      return
    }
    const signature = this.getStructureSignature()
    if (signature !== this.structureSignature) {
      this.refresh()
      return
    }
    this.renderInfo()
    this.updateProgress()
  }

  getStructureSignature(): string {
    const building = this.building
    if (!building) return ''
    const level = this.stack[this.stack.length - 1] || []
    return [
      building.technology?.type || '',
      building.queue?.join(',') || '',
      level.map(item => item.id || '').join(','),
      level.map(item => (item.hide?.() ? '1' : '0')).join(','),
    ].join('|')
  }

  render(): void {
    const building = this.building
    if (!building) return
    const items = this.stack[this.stack.length - 1] || []
    this.renderInfo()
    this.body.textContent = ''
    this.backButton.classList.toggle('is-visible', this.stack.length > 1)
    items
      .filter(button => !button.hide || !button.hide())
      .forEach(button => this.body.appendChild(this.createButton(building, button)))
    this.body.classList.toggle('is-empty', !this.body.children.length)
    this.updateProgress()
  }

  renderInfo(): void {
    const building = this.building
    this.info.textContent = ''
    if (typeof building?.interface?.info === 'function') {
      building.interface.info(this.info)
    }
  }

  createButton(building: BuildingEntity, button: MenuButtonSpec): HTMLButtonElement {
    const element = document.createElement('button')
    element.type = 'button'
    element.className = 'arpg-building-menu-button'
    element.id = button.id ? `arpg-${button.id}` : ''

    const icon = document.createElement('span')
    icon.className = 'arpg-building-menu-icon'
    let nestedPointerHandled = false
    if (button.onCreate) {
      button.onCreate(building, icon)
      icon.addEventListener('pointerup', () => {
        nestedPointerHandled = true
        setTimeout(() => {
          nestedPointerHandled = false
        })
      })
    } else {
      const image = this.menu.createActionIcon(typeof button.icon === 'function' ? button.icon() : (button.icon ?? ''))
      icon.appendChild(image)
    }

    const label = document.createElement('span')
    label.className = 'arpg-building-menu-label'
    label.textContent = buttonTitle(button)

    const meta = document.createElement('span')
    meta.className = 'arpg-building-menu-meta'
    meta.textContent = buttonMeta(button)

    const status = document.createElement('span')
    status.className = 'arpg-building-menu-status'
    const progress = document.createElement('span')
    progress.className = 'arpg-building-menu-progress'
    const progressFill = document.createElement('span')
    progressFill.className = 'arpg-building-menu-progress-fill'
    const statusText = document.createElement('span')
    statusText.className = 'arpg-building-menu-status-text'
    progress.appendChild(progressFill)
    status.appendChild(progress)
    status.appendChild(statusText)

    element.appendChild(icon)
    element.appendChild(label)
    element.appendChild(meta)
    element.appendChild(status)

    if (button.tooltip) this.menu.menuTooltip.bind(element, button.tooltip)
    element.addEventListener('click', evt => {
      if (button.onCreate) {
        if (!nestedPointerHandled && button.onClick) {
          playUiSound(SOUND_CUES.ui.menuClick)
          button.onClick(building, evt)
        }
        this.refresh()
        return
      }
      playUiSound(SOUND_CUES.ui.menuClick)
      if (button.children) {
        this.stack.push(button.children)
        this.render()
        return
      }
      if (button.onClick && isBuildingEntity(building)) {
        button.onClick(building, evt)
        this.refresh()
      }
    })

    return element
  }

  updateProgress(): void {
    const building = this.building
    if (!building) return
    this.body.querySelectorAll<HTMLElement>('.arpg-building-menu-button').forEach(button => {
      const id = button.id.replace(/^arpg-/, '')
      const status = button.querySelector<HTMLElement>('.arpg-building-menu-status')
      const fill = button.querySelector<HTMLElement>('.arpg-building-menu-progress-fill')
      const text = button.querySelector<HTMLElement>('.arpg-building-menu-status-text')
      if (!status || !fill || !text) return

      const queued = building.queue?.filter(type => type === id).length ?? 0
      const activeUnit = building.queue?.[0] === id
      const activeTechnology = building.technology?.type === id || id === `${building.technology?.type}-cancel`
      const active = activeUnit || activeTechnology
      const progress = active ? Math.max(0, Math.min(100, Math.floor(building.loading ?? 0))) : 0

      status.classList.toggle('is-visible', active || queued > 0)
      fill.style.width = `${progress}%`
      text.textContent = active ? `${progress}%${queued > 1 ? ` x${queued}` : ''}` : queued > 0 ? `x${queued}` : ''
    })
  }

  isOpen(): boolean {
    return this.opened
  }

  getTarget(): BuildingEntity | null {
    return this.building
  }

  destroy(): void {
    document.removeEventListener('keydown', this.onKeyDown)
    this.panel.remove()
  }
}
