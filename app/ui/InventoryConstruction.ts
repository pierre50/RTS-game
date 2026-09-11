import { constructionTerritoryBlocker } from '../lib/campaign/mapTerritory'
import { t } from '../lib/lang'
import { BUILDING_TYPES, CAMP_DECORATION_BUILDING_TYPES } from '../constants'
import { renderBuildingAvatar, renderTextureRefAvatar } from '../lib/avatar'
import { getReservedGameplayHotkeys } from '../lib/audio/settings'
import { getPlayerBuildingConfig } from '../lib/buildings/buildingAge'
import { getPlayerResourceTotals } from '../lib/resources/playerResourceTotals'
import { capitalizeFirstLetter } from '../lib/extra'
import type { ResourceAmount } from '../types/common'
import type { PlayerLike } from '../types/player'
import { createInventoryActionRow } from './inventory/InventoryActionRow'
import type { RuntimeEntity, UnitEntity } from '../types/entities'
import type { MenuButtonSpec, TooltipContent, TooltipSource } from '../types/ui'
import type { MenuHost } from './MenuHost'

const WHEAT_FARM_AVATAR_REF = { sheet: 'resources/wheat', frame: 4 } as const
const HIDDEN_HERO_CONSTRUCTION_BUILDINGS = new Set<string>([
  BUILDING_TYPES.fireCamp,
  BUILDING_TYPES.trap,
  BUILDING_TYPES.chest,
  BUILDING_TYPES.cave,
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
  const owner = constructionTerritoryBlocker(host.menu.context, host.menu.context.player)
  if (owner) {
    const message = document.createElement('p')
    message.className = 'construction-territory-message'
    message.setAttribute('role', 'status')
    message.textContent = t('constructionTerritoryOccupied', { player: owner.name || owner.civ || owner.label || '' })
    host.constructionPanel.appendChild(message)
  }
  if (!selection) return

  const usedKeys = new Set<string>(getReservedGameplayHotkeys())
  getInventoryConstructionButtons(host.menu)
    .filter(button => !button.hide || !button.hide())
    .forEach((button, index) => {
      const hotkey = host.menu.assignActionHotkey(button.id || '', usedKeys)
      const actionButton = createInventoryConstructionActionButton(host, button)
      const element = createInventoryConstructionRow(host, selection, actionButton, index, hotkey)
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

function resolveTooltipContent(source?: TooltipSource): TooltipContent | null {
  if (!source) return null
  return typeof source === 'function' ? source() : source
}

function getConstructionCostMetaParts(
  cost: ResourceAmount,
  player: PlayerLike,
  hero?: UnitEntity | null
): Array<{ text: string; className: string }> {
  const totals = getPlayerResourceTotals(player, { hero, includeHero: Boolean(hero) })
  const formatResourceLabel = (resource: string): string => capitalizeFirstLetter(t(resource))
  return Object.entries(cost)
    .map(([resource, amount]) => {
      const needed = Math.max(0, Math.floor(amount ?? 0))
      if (needed <= 0) return null
      const available = Math.max(0, Math.floor((totals[resource as keyof ResourceAmount] ?? 0)))
      const hasEnough = available >= needed
      return {
        text: `${formatResourceLabel(resource)} ${available}/${needed}`,
        className: hasEnough ? 'inventory-cost-is-available' : 'inventory-cost-is-missing',
      }
    })
    .filter((part): part is { text: string; className: string } => Boolean(part))
}

function isTooltipCostMetaLine(meta: string, costPrefix: string): boolean {
  return meta.trim().toLowerCase().startsWith(costPrefix)
}

function createInventoryConstructionRow(
  host: InventoryConstructionHost,
  selection: RuntimeEntity,
  button: MenuButtonSpec,
  index: number,
  _hotkey: string | null
): HTMLElement {
  const disabled = button.disabled?.(selection) ?? false
  const tooltip = resolveTooltipContent(button.tooltip)
  const { player } = host.menu.context
  const { heroUnit } = host.menu.context.controls
  const config = button.id ? getPlayerBuildingConfig(player, button.id, player.age) : undefined
  const costMetaParts = config?.cost ? getConstructionCostMetaParts(config.cost, player, heroUnit) : []
  const tooltipCostPrefix = t('tooltipCost', { cost: '' }).trim().toLowerCase()
  const tooltipHpPrefix = t('tooltipBuildingHP', { value: '' }).trim().toLowerCase()
  const tooltipMeta = (tooltip?.meta ?? [])
    .filter(Boolean)
    .filter(meta => !isTooltipCostMetaLine(meta, tooltipCostPrefix))
    .filter(meta => !isTooltipCostMetaLine(meta, tooltipHpPrefix))
  const { element, icon } = createInventoryActionRow(host.menu, {
    id: button.id || `construction-${index}`,
    className: 'inventory-construction-row',
    disabled,
    title: tooltip?.title ?? t(button.id || ''),
    description: tooltip?.description,
    meta: tooltipMeta.join(' | '),
    metaParts: costMetaParts,
    trailingAction: {
      label: t('inventoryBuildAction'),
      disabled,
      onClick: evt => {
        if (button.disabled?.(selection)) return
        button.onClick?.(selection, evt)
      },
    },
  })
  renderConstructionButtonAvatar(host.menu, icon, button)

  return element
}

function renderConstructionButtonAvatar(menu: MenuHost, icon: HTMLElement, button: MenuButtonSpec): void {
  if (!button.id) return
  const img = document.createElement('img')
  img.className = 'img'
  img.alt = ''
  const canvas = document.createElement('canvas')
  canvas.width = 120
  canvas.height = 120
  const { app, player } = menu.context
  const rendered =
    button.id === BUILDING_TYPES.farm
      ? renderTextureRefAvatar(app, WHEAT_FARM_AVATAR_REF, canvas)
      : renderBuildingAvatar(app, button.id, player, canvas)
  if (rendered) img.src = canvas.toDataURL()
  icon.appendChild(img)
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
