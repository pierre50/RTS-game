import { FAMILY_TYPES } from '../constants'
import { Modal } from '../lib'
import { renderAnimalAvatar, renderResourceAvatar, renderUnitHeadAvatar } from '../lib/avatar'
import { t } from '../lib/lang'
import type { Application } from 'pixi.js'
import type Menu from '../classes/Menu'
import type { AnimalEntity, BuildingEntity, ResourceEntity, RuntimeEntity, UnitEntity } from '../types/entities'

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

function isAnimalEntity(entity: RuntimeEntity): entity is AnimalEntity {
  return entity.family === FAMILY_TYPES.animal
}

function isResourceEntity(entity: RuntimeEntity): entity is ResourceEntity {
  return entity.family === FAMILY_TYPES.resource
}

function createEntityAvatar(app: Application, entity: RuntimeEntity): HTMLDivElement | null {
  const canvas = document.createElement('canvas')
  canvas.width = 120
  canvas.height = 120

  const rendered = isUnitEntity(entity)
    ? renderUnitHeadAvatar(app, entity, canvas)
    : isAnimalEntity(entity)
      ? renderAnimalAvatar(app, entity, canvas)
      : isResourceEntity(entity)
        ? renderResourceAvatar(app, entity, canvas)
        : false
  if (!rendered) return null

  const wrap = document.createElement('div')
  wrap.className = 'unit-avatar-frame'
  wrap.appendChild(canvas)
  return wrap
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

    const content = document.createElement('div')
    content.className = 'entity-info-modal selection-info active'
    entity.interface.info(content)

    const avatar = createEntityAvatar(this.menu.context.app, entity)
    let modalContent: HTMLElement = content
    if (avatar) {
      modalContent = document.createElement('div')
      modalContent.className = 'entity-info-wrapper'
      modalContent.appendChild(avatar)
      modalContent.appendChild(content)
    }

    this.entity = entity
    this.modal = new Modal({
      title: getEntityTitle(entity),
      content: modalContent,
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

  isOpen(): boolean {
    return Boolean(this.modal)
  }
}
