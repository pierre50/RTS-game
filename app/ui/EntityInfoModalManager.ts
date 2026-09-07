import { FAMILY_TYPES } from '../constants'
import { renderAnimalAvatar, renderResourceAvatar, renderUnitHeadAvatar } from '../lib/avatar'
import { createInspectionModal } from './InspectionPanel'
import { getEntityDisplayName } from './utils/entityDisplayName'
import type { Application } from 'pixi.js'
import type { Modal } from '../lib'
import type {
  AnimalEntity,
  BuildingEntity,
  EntityInfoRenderOptions,
  ResourceEntity,
  RuntimeEntity,
  UnitEntity,
} from '../types/entities'
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

export const TITLED_ENTITY_INFO_OPTIONS: EntityInfoRenderOptions = { hideIdentity: true }

// Shared with NpcOrdersManager, which embeds this same stats+avatar block above its order
// buttons when the order panel targets a single unit.
export function createEntityInfoContent(
  app: Application,
  entity: RuntimeEntity,
  options?: EntityInfoRenderOptions
): HTMLElement {
  const content = document.createElement('div')
  content.className = 'entity-info-modal selection-info active'
  entity.interface?.info?.(content, options)

  const avatar = createEntityAvatar(app, entity)
  if (!avatar) return content

  const wrapper = document.createElement('div')
  wrapper.className = 'entity-info-wrapper'
  wrapper.appendChild(avatar)
  wrapper.appendChild(content)
  return wrapper
}

export function createTitledEntityInfoContent(
  app: Application,
  entity: RuntimeEntity,
  options?: EntityInfoRenderOptions
): HTMLElement {
  return createEntityInfoContent(app, entity, { ...options, ...TITLED_ENTITY_INFO_OPTIONS })
}

export class EntityInfoModalManager {
  menu: MenuHost
  modal?: Modal
  entity: RuntimeEntity | null
  infoPanel: HTMLElement | null

  constructor(menu: MenuHost) {
    this.menu = menu
    this.entity = null
    this.infoPanel = null
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

    const modalContent = createTitledEntityInfoContent(this.menu.context.app, entity)

    this.entity = entity
    this.infoPanel = this.getInfoPanel(modalContent)
    this.modal = createInspectionModal({
      title: getEntityTitle(entity),
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
    const infoPanel = this.infoPanel
    if (!this.modal || !entity || !infoPanel || entity.isDestroyed) return
    infoPanel.replaceChildren()
    entity.interface?.info?.(infoPanel, TITLED_ENTITY_INFO_OPTIONS)
  }

  getInfoPanel(content: HTMLElement): HTMLElement | null {
    return content.classList.contains('selection-info')
      ? content
      : content.querySelector<HTMLElement>('.selection-info')
  }
}
