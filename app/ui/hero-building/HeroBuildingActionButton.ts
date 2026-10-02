import { FAMILY_TYPES, SOUND_CUES } from '../../constants'
import { playUiSound } from '../../lib/audio/uiSound'
import type { BuildingEntity } from '../../types/entities'
import type { MenuButtonSpec } from '../../types/ui'
import type { MenuHost } from '../MenuHost'
import { buttonMeta, buttonTitle } from './HeroBuildingButtonText'

type NestedPointerState = { handled: boolean }

export type HeroBuildingActionButtonHandlers = {
  refresh: () => void
  openChildren: (children: MenuButtonSpec[]) => void
}

function isBuildingEntity(value: unknown): value is BuildingEntity {
  return Boolean(value && (value as BuildingEntity).family === FAMILY_TYPES.building)
}

function createSpan(className: string, text?: string): HTMLSpanElement {
  const span = document.createElement('span')
  span.className = className
  if (text !== undefined) span.textContent = text
  return span
}

function createActionButtonIcon(
  menu: MenuHost,
  building: BuildingEntity,
  button: MenuButtonSpec,
  pointer: NestedPointerState
): HTMLSpanElement {
  const icon = createSpan('hero-building-menu-icon')
  if (button.onCreate) {
    button.onCreate(building, icon)
    icon.addEventListener('pointerup', () => {
      pointer.handled = true
      setTimeout(() => {
        pointer.handled = false
      })
    })
    return icon
  }
  const iconSrc = typeof button.icon === 'function' ? button.icon() : button.icon
  if (iconSrc) {
    const image = menu.createActionIcon(iconSrc)
    icon.appendChild(image)
  }
  return icon
}

function handleActionButtonClick(
  building: BuildingEntity,
  button: MenuButtonSpec,
  evt: MouseEvent,
  pointer: NestedPointerState,
  handlers: HeroBuildingActionButtonHandlers
): void {
  if (button.disabled?.()) return
  if (button.onCreate) {
    if (!pointer.handled && button.onClick) {
      playUiSound(SOUND_CUES.ui.menuClick)
      button.onClick(building, evt)
    }
    handlers.refresh()
    return
  }
  playUiSound(SOUND_CUES.ui.menuClick)
  if (button.children) {
    handlers.openChildren(button.children)
    return
  }
  if (button.onClick && isBuildingEntity(building)) {
    button.onClick(building, evt)
    handlers.refresh()
  }
}

export function createHeroBuildingActionButton(
  menu: MenuHost,
  building: BuildingEntity,
  button: MenuButtonSpec,
  options: { trainingIndex?: number },
  handlers: HeroBuildingActionButtonHandlers
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

  const pointer: NestedPointerState = { handled: false }
  const icon = createActionButtonIcon(menu, building, button, pointer)
  const label = createSpan('hero-building-menu-label', buttonTitle(button))
  const meta = createSpan('hero-building-menu-meta', buttonMeta(button, { hideMeta: options.trainingIndex != null }))
  const status = createSpan('hero-building-menu-status')
  status.appendChild(createSpan('hero-building-menu-status-text'))

  if (icon.childElementCount > 0) element.appendChild(icon)
  element.appendChild(label)
  element.appendChild(meta)
  element.appendChild(status)

  element.addEventListener('click', evt => handleActionButtonClick(building, button, evt, pointer, handlers))

  return element
}
