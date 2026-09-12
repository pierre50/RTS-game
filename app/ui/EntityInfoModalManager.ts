import { InteractionPanel } from './InteractionPanel'
import { createTitledEntityInfoContent, TITLED_ENTITY_INFO_OPTIONS } from './EntityInfoContent'
import { UnitInventoryScreen } from './inventory/UnitInventoryScreen'
import { BUILDING_TYPES, FAMILY_TYPES } from '../constants'
import { createInspectionModal } from './InspectionPanel'
import { getEntityDisplayName } from './utils/entityDisplayName'
import type { Modal } from '../lib'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import type { MenuHost } from './MenuHost'

function getEntityTitle(entity: RuntimeEntity): string {
  return getEntityDisplayName(entity)
}

function isBuildingEntity(entity: RuntimeEntity): entity is BuildingEntity {
  return entity.family === FAMILY_TYPES.building
}

function isUnitEntity(entity: RuntimeEntity): entity is UnitEntity {
  return entity.family === FAMILY_TYPES.unit
}

export class EntityInfoModalManager {
  menu: MenuHost
  modal?: Modal
  entity: RuntimeEntity | null
  inventoryScreen?: UnitInventoryScreen
  layout?: InteractionPanel
  infoPanel: HTMLElement | null

  constructor(menu: MenuHost) {
    this.menu = menu
    this.entity = null
    this.infoPanel = null
  }

  open(entity: RuntimeEntity): boolean {
    if (isBuildingEntity(entity) && entity.type === BUILDING_TYPES.trap) return false
    if (entity === this.menu.context.controls?.heroUnit) return false
    if (!entity.interface?.info || entity.isDestroyed) return false
    if (this.modal && this.entity === entity) return true
    this.close()

    const player = this.menu.context.player
    player?.unselectAll?.()
    entity.select?.()
    if (isBuildingEntity(entity) && entity.owner === player) {
      player.selectedBuilding = entity
    } else if (isUnitEntity(entity) && entity.owner === player) {
      player.selectedUnit = entity
      player.selectedUnits = [entity]
    } else {
      player.selectedOther = entity
    }

    this.inventoryScreen =
      isUnitEntity(entity) && entity.isDead ? new UnitInventoryScreen(this.menu, entity) : undefined
    this.layout = this.inventoryScreen ? undefined : new InteractionPanel()
    const infoContent =
      this.inventoryScreen?.element ??
      createTitledEntityInfoContent(this.menu.context.app, entity, {
        actionsContainer: this.layout?.secondaryActions,
      })
    if (this.layout) {
      this.layout.information.appendChild(infoContent)
      this.layout.actions.appendChild(this.layout.secondaryActions)
    }
    const modalContent = this.layout?.element ?? infoContent

    this.entity = entity
    this.infoPanel = this.getInfoPanel(infoContent)
    this.modal =
      this.inventoryScreen?.open(() => this.close()) ??
      createInspectionModal({
        proximity: { context: this.menu.context, targets: () => [entity] },
        title: getEntityTitle(entity),
        interaction: true,
        content: modalContent,
        onClose: () => this.close(),
      })
    return true
  }

  close(): void {
    if (!this.modal && !this.entity) return
    const modal = this.modal
    const entity = this.entity
    this.modal = undefined
    this.entity = null
    this.infoPanel = null
    this.inventoryScreen = undefined
    this.layout = undefined
    modal?.close()

    const player = this.menu.context.player
    if (!entity || !player) return
    if (player.selectedBuilding === entity || player.selectedUnit === entity || player.selectedOther === entity) {
      player.unselectAll?.()
    } else {
      entity.unselect?.()
    }
  }

  isOpen(): boolean {
    return Boolean(this.modal)
  }

  syncLiveState(): void {
    const entity = this.entity
    if (this.inventoryScreen) {
      this.inventoryScreen.render()
      return
    }
    const infoPanel = this.infoPanel
    if (!this.modal || !entity || !infoPanel || entity.isDestroyed) return
    infoPanel.replaceChildren()
    this.layout?.secondaryActions.replaceChildren()
    entity.interface?.info?.(infoPanel, {
      ...TITLED_ENTITY_INFO_OPTIONS,
      actionsContainer: this.layout?.secondaryActions,
    })
  }

  getInfoPanel(content: HTMLElement): HTMLElement | null {
    return content.classList.contains('selection-info')
      ? content
      : content.querySelector<HTMLElement>('.selection-info')
  }
}
