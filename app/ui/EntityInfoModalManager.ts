import { FAMILY_TYPES } from '../constants'
import { Modal } from '../lib'
import { t } from '../lib/lang'
import type Menu from '../classes/Menu'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../types/entities'

function getEntityTitle(entity: RuntimeEntity): string {
  const assetType = (entity as { assetType?: string }).assetType
  return t(assetType || entity.type)
}

function isBuildingEntity(entity: RuntimeEntity): entity is BuildingEntity {
  return entity.family === FAMILY_TYPES.building
}

function isUnitEntity(entity: RuntimeEntity): entity is UnitEntity {
  return entity.family === FAMILY_TYPES.unit
}

export class EntityInfoModalManager {
  menu: Menu
  modal?: Modal
  entity: RuntimeEntity | null

  constructor(menu: Menu) {
    this.menu = menu
    this.entity = null
  }

  open(entity: RuntimeEntity): boolean {
    if (entity === this.menu.context.controls?.heroUnit) return false
    if (!entity.interface?.info || entity.isDestroyed || entity.isDead) return false
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

    const content = document.createElement('div')
    content.className = 'entity-info-modal selection-info active'
    entity.interface.info(content)

    this.entity = entity
    this.modal = new Modal({
      title: getEntityTitle(entity),
      content,
      onClose: () => this.close(),
    })
    this.modal._panel?.classList.add('entity-info-modal-panel')
    return true
  }

  close(): void {
    if (!this.modal && !this.entity) return
    const modal = this.modal
    const entity = this.entity
    this.modal = undefined
    this.entity = null
    modal?.close()

    const player = this.menu.context.player
    if (!entity || !player) return
    if (player.selectedBuilding === entity || player.selectedUnit === entity || player.selectedOther === entity) {
      player.unselectAll?.()
    } else {
      entity.unselect?.()
    }
  }
}
