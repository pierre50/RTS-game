import { BUILDING_TYPES, CAMP_DECORATION_BUILDING_TYPES } from '../constants'
import { renderBuildingAvatar, renderTextureRefAvatar } from '../lib/avatar'
import { getReservedGameplayHotkeys } from '../lib/audio/settings'
import type { RuntimeEntity } from '../types/entities'
import type { MenuButtonSpec } from '../types/ui'
import type { MenuHost } from './MenuHost'

const WHEAT_FARM_AVATAR_REF = { sheet: 'resources/wheat', frame: 4 } as const
const HIDDEN_HERO_CONSTRUCTION_BUILDINGS = new Set<string>([
  BUILDING_TYPES.fireCamp,
  BUILDING_TYPES.trap,
  ...CAMP_DECORATION_BUILDING_TYPES,
])

type InventoryConstructionHost = {
  constructionPanel: HTMLDivElement
  menu: MenuHost
  close(): void
}

function isHeroConstructionBuildingType(type: string): boolean {
  return !HIDDEN_HERO_CONSTRUCTION_BUILDINGS.has(type)
}

export function getInventoryConstructionButtons(menu: MenuHost): MenuButtonSpec[] {
  const { player } = menu.context
  return Object.keys(player.config.buildings)
    .filter(isHeroConstructionBuildingType)
    .map(type => menu.getActionBuildingButton(type))
}

export function renderInventoryConstruction(host: InventoryConstructionHost): void {
  const selection = host.menu.context.controls.heroUnit || host.menu.selection
  host.constructionPanel.textContent = ''
  host.menu.clearActionHotkeys()
  if (!selection) return

  const usedKeys = new Set<string>(getReservedGameplayHotkeys())
  getInventoryConstructionButtons(host.menu)
    .filter(button => !button.hide || !button.hide())
    .forEach((button, index) => {
      const hotkey = host.menu.assignActionHotkey(button.id || '', usedKeys)
      const actionButton = createInventoryConstructionActionButton(host, button)
      const element = host.menu.createActionMenuButton(selection, actionButton, index, hotkey, () => {})
      renderConstructionButtonAvatar(host.menu, element, button)
      host.constructionPanel.appendChild(element)
      bindConstructionHotkey(host, selection, button, hotkey)
    })
}

function createInventoryConstructionActionButton(
  host: InventoryConstructionHost,
  button: MenuButtonSpec
): MenuButtonSpec {
  return {
    ...button,
    onClick: (target, evt) => {
      evt?.preventDefault?.()
      evt?.stopPropagation?.()
      button.onClick?.(target, evt)
      if (host.menu.context.controls.mouseBuilding) host.close()
    },
  }
}

function renderConstructionButtonAvatar(menu: MenuHost, element: HTMLElement, button: MenuButtonSpec): void {
  if (!button.id) return
  const icon = element.querySelector<HTMLImageElement>('.img')
  const canvas = document.createElement('canvas')
  canvas.width = 120
  canvas.height = 120
  const { app, player } = menu.context
  const rendered =
    button.id === BUILDING_TYPES.farm
      ? renderTextureRefAvatar(app, WHEAT_FARM_AVATAR_REF, canvas)
      : renderBuildingAvatar(app, button.id, player, canvas)
  if (icon && rendered) {
    icon.src = canvas.toDataURL()
  }
}

function bindConstructionHotkey(
  host: InventoryConstructionHost,
  selection: RuntimeEntity,
  button: MenuButtonSpec,
  hotkey: string | null
): void {
  if (!hotkey || typeof button.onClick !== 'function') return
  host.menu.setActionHotkey(hotkey, () => {
    host.menu.playUiClick()
    button.onClick!(selection, null)
    if (host.menu.context.controls.mouseBuilding) host.close()
  })
}
