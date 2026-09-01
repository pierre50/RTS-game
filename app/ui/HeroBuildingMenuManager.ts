import { BUILDING_TYPES, FAMILY_TYPES, SOUND_CUES } from '../constants'
import { renderBuildingAvatar } from '../lib/avatar'
import { isHeroInteractionTargetReachable } from '../lib/hero/heroActionRange'
import { formatTrainingEntryTimeRemaining, formatTrainingTimeRemaining } from '../lib/buildings/trainingTimeRemaining'
import { t } from '../lib/lang'
import { playAudibleSoundCue } from '../lib/audio/sound'
import { playUiSound } from '../lib/audio/uiSound'
import { createInspectionModal } from './InspectionPanel'
import { TITLED_ENTITY_INFO_OPTIONS } from './EntityInfoModalManager'
import { getBuildingDisplayName } from './utils/entityDisplayName'
import { createHeroBuildingContainerBody } from './hero-building/HeroBuildingContainerBody'
import type { Modal } from '../lib'
import type { BuildingEntity } from '../types/entities'
import type { MenuButtonSpec } from '../types/ui'
import type { MenuHost } from './MenuHost'
import type { InventoryTransferPanel } from './inventory/InventoryTransferPanel'

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

function getPendingTrainingCount(building: BuildingEntity, type: string): number {
  return (
    building.owner?.units?.filter(unit => unit.dest === building && unit.trainingTargetType === type && !unit.isDead)
      .length ?? 0
  )
}

export class HeroBuildingMenuManager {
  menu: MenuHost
  panel: HTMLDivElement
  header: HTMLDivElement
  infoAvatarWrap: HTMLDivElement
  infoAvatarCanvas: HTMLCanvasElement
  info: HTMLDivElement
  body: HTMLDivElement
  backButton: HTMLButtonElement
  modal?: Modal
  building: BuildingEntity | null
  stack: MenuButtonSpec[][]
  opened: boolean
  structureSignature: string
  transferPanel: InventoryTransferPanel | null

  constructor(menu: MenuHost) {
    this.menu = menu
    this.building = null
    this.stack = []
    this.opened = false
    this.structureSignature = ''
    this.transferPanel = null

    this.panel = document.createElement('div')
    this.panel.className = 'hero-building-menu'

    this.backButton = document.createElement('button')
    this.backButton.type = 'button'
    this.backButton.className = 'hero-building-menu-nav ui-btn'
    this.backButton.textContent = '<'
    this.backButton.addEventListener('click', () => this.back())

    this.body = document.createElement('div')
    this.body.className = 'hero-building-menu-body'

    this.infoAvatarWrap = document.createElement('div')
    this.infoAvatarWrap.className = 'unit-avatar-frame'
    this.infoAvatarCanvas = document.createElement('canvas')
    this.infoAvatarCanvas.width = 120
    this.infoAvatarCanvas.height = 120
    this.infoAvatarWrap.appendChild(this.infoAvatarCanvas)

    this.info = document.createElement('div')
    this.info.className = 'entity-info-modal selection-info active'

    this.header = document.createElement('div')
    this.header.className = 'entity-info-wrapper'
    this.header.appendChild(this.infoAvatarWrap)
    this.header.appendChild(this.info)

    this.panel.appendChild(this.backButton)
    this.panel.appendChild(this.header)
    this.panel.appendChild(this.body)
  }

  canOpenFor(building: BuildingEntity | null | undefined): building is BuildingEntity {
    const hero = this.menu.context.controls.heroUnit
    if (!hero || !building || building.isDestroyed || building.isDead) return false
    return isHeroInteractionTargetReachable(hero, null, building)
  }

  open(building: BuildingEntity): boolean {
    if (!this.canOpenFor(building)) return false
    if (this.opened && this.building === building) {
      this.refresh()
      return true
    }
    if (this.opened) this.close()
    const items = this.menu.getActionMenuItems(building)
    this.building = building
    this.stack = [items]
    this.opened = true
    this.structureSignature = this.getStructureSignature()
    this.modal = createInspectionModal({
      title: getBuildingDisplayName(building),
      content: this.panel,
      onClose: () => this.close(),
    })
    if (building.type === BUILDING_TYPES.chest) {
      playAudibleSoundCue(building, SOUND_CUES.building.chestOpen, { profile: 'surface' })
    }
    this.render()
    return true
  }

  close(): void {
    if (!this.opened && !this.modal) return
    this.menu.menuTooltip.hide()
    const modal = this.modal
    this.modal = undefined
    const building = this.building
    this.building = null
    this.stack = []
    this.opened = false
    this.structureSignature = ''
    this.info.textContent = ''
    this.body.textContent = ''
    this.transferPanel = null
    modal?.close()
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
    if (!this.building || this.building.isDestroyed || this.building.isDead) {
      this.close()
      return
    }
    this.stack[0] = this.menu.getActionMenuItems(this.building)
    this.structureSignature = this.getStructureSignature()
    this.render()
  }

  syncLiveState(): void {
    if (!this.opened || !this.building) return
    if (this.building.isDestroyed || this.building.isDead) {
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

  refreshInventory(): void {
    if (this.building?.type !== BUILDING_TYPES.chest) return
    this.syncLiveState()
  }

  getStructureSignature(): string {
    const building = this.building
    if (!building) return ''
    const level = this.stack[this.stack.length - 1] || []
    return [
      building.technology?.type || '',
      building.queue?.join(',') || '',
      building.trainingQueue
        ?.map(entry => `${entry.type}:${entry.trainingStartedDay ?? ''}:${entry.trainingCompleteDay ?? ''}`)
        .join(',') || '',
      building.owner?.units
        ?.filter(unit => unit.dest === building && unit.trainingTargetType)
        .map(unit => unit.trainingTargetType)
        .join(',') || '',
      level.map(item => item.id || '').join(','),
      level.map(item => (item.hide?.() ? '1' : '0')).join(','),
      this.getContainerSignature(building),
    ].join('|')
  }

  getContainerSignature(building: BuildingEntity): string {
    if (building.type !== BUILDING_TYPES.chest) return ''
    const hero = this.menu.context.controls.heroUnit
    return [
      building.inventory?.equipment?.join(',') || '',
      JSON.stringify(building.inventory?.resources ?? {}),
      hero?.inventory?.equipment?.join(',') || '',
      JSON.stringify(hero?.inventory?.resources ?? {}),
    ].join('|')
  }

  render(): void {
    const building = this.building
    if (!building) return
    // Only re-extracted on open/refresh (structure changes), not on every
    // syncLiveState() tick — renderInfo() alone runs far more often (e.g. on
    // every training-progress update) and re-cropping the avatar each time
    // would be wasteful.
    const rendered = renderBuildingAvatar(
      this.menu.context.app,
      building.type,
      building.owner ?? this.menu.context.player,
      this.infoAvatarCanvas
    )
    this.infoAvatarWrap.classList.toggle('hidden', !rendered)
    const items = this.stack[this.stack.length - 1] || []
    this.renderInfo()
    this.body.textContent = ''
    this.backButton.classList.toggle('is-visible', this.stack.length > 1)
    if (this.renderContainerBody(building)) {
      this.body.classList.toggle('is-empty', false)
      this.updateProgress()
      return
    }
    items
      .filter(button => !button.hide || !button.hide())
      .forEach(button => {
        const trainingEntries = building.trainingQueue
          ?.map((entry, index) => ({ entry, index }))
          .filter(({ entry }) => entry.type === button.id)
        if (trainingEntries?.length) {
          for (const { index } of trainingEntries) {
            this.body.appendChild(this.createButton(building, button, { trainingIndex: index }))
          }
          return
        }
        this.body.appendChild(this.createButton(building, button))
      })
    this.body.classList.toggle('is-empty', !this.body.children.length)
    this.updateProgress()
  }

  renderContainerBody(building: BuildingEntity): boolean {
    this.transferPanel = createHeroBuildingContainerBody(building, this.menu, () => {
      this.structureSignature = this.getStructureSignature()
      this.renderInfo()
    })
    if (!this.transferPanel) return false
    this.body.appendChild(this.transferPanel.element)
    return true
  }

  renderInfo(): void {
    const building = this.building
    this.info.textContent = ''
    if (typeof building?.interface?.info === 'function') {
      building.interface.info(this.info, TITLED_ENTITY_INFO_OPTIONS)
    }
  }

  createButton(
    building: BuildingEntity,
    button: MenuButtonSpec,
    options: { trainingIndex?: number } = {}
  ): HTMLButtonElement {
    const element = document.createElement('button')
    element.type = 'button'
    element.className = 'ui-btn ui-action-row'
    element.id = button.id ? `hero-${button.id}${options.trainingIndex == null ? '' : `-${options.trainingIndex}`}` : ''
    if (button.id) element.dataset.actionId = button.id
    if (options.trainingIndex != null) element.dataset.trainingIndex = String(options.trainingIndex)
    if (!button.icon && !button.onCreate) element.classList.add('is-text-only')
    if (button.id?.startsWith('stableDebug')) element.classList.add('hero-building-menu-debug')
    const disabled = button.disabled?.() ?? false
    element.disabled = disabled

    const icon = document.createElement('span')
    icon.className = 'hero-building-menu-icon'
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
      const iconSrc = typeof button.icon === 'function' ? button.icon() : button.icon
      if (iconSrc) {
        const image = this.menu.createActionIcon(iconSrc)
        icon.appendChild(image)
      }
    }

    const label = document.createElement('span')
    label.className = 'hero-building-menu-label'
    label.textContent = buttonTitle(button)

    const meta = document.createElement('span')
    meta.className = 'hero-building-menu-meta'
    meta.textContent = buttonMeta(button)

    const status = document.createElement('span')
    status.className = 'hero-building-menu-status'
    const statusText = document.createElement('span')
    statusText.className = 'hero-building-menu-status-text'
    status.appendChild(statusText)

    if (icon.childElementCount > 0) element.appendChild(icon)
    element.appendChild(label)
    element.appendChild(meta)
    element.appendChild(status)

    if (button.tooltip) this.menu.menuTooltip.bind(element, button.tooltip)
    element.addEventListener('click', evt => {
      if (button.disabled?.()) return
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
    this.body.querySelectorAll<HTMLElement>('button.ui-btn').forEach(button => {
      const id = button.dataset.actionId || button.id.replace(/^hero-/, '')
      const status = button.querySelector<HTMLElement>('.hero-building-menu-status')
      const text = button.querySelector<HTMLElement>('.hero-building-menu-status-text')
      if (!status || !text) return
      const trainingIndex = button.dataset.trainingIndex == null ? null : Number(button.dataset.trainingIndex)
      const trainingEntry =
        trainingIndex != null && Number.isFinite(trainingIndex) ? building.trainingQueue?.[trainingIndex] : null
      if (trainingEntry) {
        const progress = Math.max(0, Math.min(100, Math.floor(trainingEntry.loading ?? 0)))
        status.classList.toggle('is-visible', true)
        text.textContent = formatTrainingEntryTimeRemaining(building, trainingEntry) ?? `${progress}%`
        return
      }

      const queued = building.queue?.filter(type => type === id).length ?? 0
      const reserved = getPendingTrainingCount(building, id)
      const activeUnit = building.queue?.[0] === id
      const activeTechnology = building.technology?.type === id || id === `${building.technology?.type}-cancel`
      const active = activeUnit || activeTechnology
      const progress = active ? Math.max(0, Math.min(100, Math.floor(building.loading ?? 0))) : 0

      status.classList.toggle('is-visible', active || queued > 0 || reserved > 0)
      text.textContent = active
        ? activeUnit
          ? (formatTrainingTimeRemaining(building) ?? `${progress}%`)
          : `${progress}%`
        : queued > 0
          ? '...'
          : reserved
            ? '...'
            : ''
    })
  }

  isOpen(): boolean {
    return this.opened
  }

  getTarget(): BuildingEntity | null {
    return this.building
  }

  destroy(): void {
    this.modal?.close()
    this.modal = undefined
  }
}
