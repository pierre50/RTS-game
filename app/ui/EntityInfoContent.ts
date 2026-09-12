import { FAMILY_TYPES } from '../constants'
import { renderAnimalAvatar, renderResourceAvatar, renderUnitHeadAvatar } from '../lib/avatar'
import type { Application } from 'pixi.js'
import type {
  AnimalEntity,
  ResourceEntity,
  UnitEntity,
  RuntimeEntity,
  EntityInfoRenderOptions,
} from '../types/entities'

export function createEntityAvatar(app: Application, entity: RuntimeEntity): HTMLDivElement | null {
  const canvas = document.createElement('canvas')
  canvas.width = 120
  canvas.height = 120

  const rendered =
    entity.family === FAMILY_TYPES.unit
      ? renderUnitHeadAvatar(app, entity as UnitEntity, canvas)
      : entity.family === FAMILY_TYPES.animal
        ? renderAnimalAvatar(app, entity as AnimalEntity, canvas)
        : entity.family === FAMILY_TYPES.resource
          ? renderResourceAvatar(app, entity as ResourceEntity, canvas)
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
