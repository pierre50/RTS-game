import { FAMILY_TYPES } from '../constants'
import { changeSpriteColor } from '../lib'
import { renderAnimalAvatar, renderResourceAvatar, renderUnitHeadAvatar } from '../lib/avatar'
import { t } from '../lib/lang'
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
import type { RecolorableSprite } from '../lib'
import type { MenuHost } from './MenuHost'

const PORTAL_RESOURCE_TYPE = 'Portal'
const PORTAL_COLOR_CHOICES = ['blue', 'yellow', 'red'] as const
const PORTAL_COLOR_LABEL_KEYS: Record<(typeof PORTAL_COLOR_CHOICES)[number], string> = {
  blue: 'portalColorBlue',
  yellow: 'portalColorYellow',
  red: 'portalColorRed',
}

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

function createPortalColorOptions(menu: MenuHost, portal: ResourceEntity): HTMLDivElement {
  const currentColor = portal.color || 'blue'
  const group = document.createElement('div')
  group.className = 'portal-color-options npc-orders-options'

  for (const color of PORTAL_COLOR_CHOICES) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'portal-color-option ui-btn'
    button.textContent = t(PORTAL_COLOR_LABEL_KEYS[color])
    button.classList.toggle('is-selected', currentColor === color)
    button.addEventListener('click', () => {
      portal.color = color
      if (portal.sprite) changeSpriteColor(portal.sprite as RecolorableSprite, color)
      for (const sibling of group.querySelectorAll('.portal-color-option')) {
        sibling.classList.toggle('is-selected', sibling === button)
      }
      menu.playUiClick()
      menu.closeEntityInfoModal?.()
      menu.context.travelThroughPortal?.(portal, color)
    })
    group.appendChild(button)
  }

  return group
}

function createPortalInfoModalContent(menu: MenuHost, portal: ResourceEntity): HTMLElement {
  const content = document.createElement('div')
  content.className = 'portal-info-modal-content'
  const infoContent = createTitledEntityInfoContent(menu.context.app, portal)
  appendPortalDescription(infoContent)
  content.appendChild(infoContent)

  content.appendChild(createPortalColorOptions(menu, portal))
  return content
}

function appendPortalDescription(infoContent: HTMLElement): void {
  const description = document.createElement('p')
  description.className = 'portal-description'
  description.textContent = t('portalDescriptionMysterious')
  const infoPanel = infoContent.classList.contains('selection-info')
    ? infoContent
    : infoContent.querySelector<HTMLElement>('.selection-info')
  if (infoPanel) {
    infoPanel.appendChild(description)
  } else {
    infoContent.appendChild(description)
  }
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

    const modalContent =
      isResourceEntity(entity) && entity.type === PORTAL_RESOURCE_TYPE
        ? createPortalInfoModalContent(this.menu, entity)
        : createTitledEntityInfoContent(this.menu.context.app, entity)

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
    if (isResourceEntity(entity) && entity.type === PORTAL_RESOURCE_TYPE) appendPortalDescription(infoPanel)
  }

  getInfoPanel(content: HTMLElement): HTMLElement | null {
    return content.classList.contains('selection-info')
      ? content
      : content.querySelector<HTMLElement>('.selection-info')
  }
}
