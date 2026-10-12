import { attachVariantRow } from '../lib/ui/VariantRow'
import { INTERIOR_FURNITURE_CATEGORIES, isInteriorFurniture } from '../lib/buildings/furniture/interiorFurnitureCatalog'
import { createInventorySection } from './inventory/InventorySection'
import { isSowingPlacement } from '../lib/buildings/campConstruction'
import { getActiveInteractionSpace } from '../lib/mapSpaces'
import { t } from '../lib/lang'
import { BUILDING_TYPES, CAMP_DECORATION_BUILDING_TYPES } from '../constants'
import { renderBuildingAvatar, renderTextureRefAvatar } from '../lib/avatar'
import { getReservedGameplayHotkeys } from '../lib/audio/settings'
import { getBuildingLevels, getPlayerBuildingConfig } from '../lib/buildings/buildingLevel'
import { createInventoryActionRow } from './inventory/InventoryActionRow'
import type { RuntimeEntity } from '../types/entities'
import type { MenuButtonSpec, MenuDetails, MenuDetailsSource } from '../types/ui'
import type { MenuHost } from './MenuHost'

const WHEAT_FARM_AVATAR_REF = { sheet: 'resources/wheat', frame: 4 } as const
const HIDDEN_HERO_CONSTRUCTION_BUILDINGS = new Set<string>([BUILDING_TYPES.cave, ...CAMP_DECORATION_BUILDING_TYPES])

const CONSTRUCTION_CATEGORIES: ReadonlyArray<{ titleKey: string; types: readonly string[] }> = [
  {
    titleKey: 'constructionCategoryCamp',
    types: [BUILDING_TYPES.fireCamp, BUILDING_TYPES.campBrazier, BUILDING_TYPES.chest, BUILDING_TYPES.trap],
  },
  {
    titleKey: 'constructionCategoryVillage',
    types: [BUILDING_TYPES.townCenter, BUILDING_TYPES.house, BUILDING_TYPES.temple],
  },
  {
    titleKey: 'constructionCategoryEconomy',
    types: [
      BUILDING_TYPES.farm,
      BUILDING_TYPES.granary,
      BUILDING_TYPES.storagePit,
      BUILDING_TYPES.forge,
      BUILDING_TYPES.market,
    ],
  },
  {
    titleKey: 'constructionCategoryMilitary',
    types: [BUILDING_TYPES.barracks, BUILDING_TYPES.archeryRange, BUILDING_TYPES.stable],
  },
  { titleKey: 'constructionCategoryDefense', types: [BUILDING_TYPES.watchTower, BUILDING_TYPES.smallWall] },
]

type InventoryConstructionHost = {
  constructionPanel: HTMLDivElement
  menu: MenuHost
  close(): void
}

const selectedLevels = new WeakMap<InventoryConstructionHost, Map<string, number>>()

function isHeroConstructionBuildingType(type: string): boolean {
  return type === BUILDING_TYPES.campBrazier || !HIDDEN_HERO_CONSTRUCTION_BUILDINGS.has(type)
}

export function getInventoryConstructionButtons(menu: MenuHost): MenuButtonSpec[] {
  const { player } = menu.context
  const interior = getActiveInteractionSpace(menu.context)?.kind === 'interior'
  return Object.keys(player.config.buildings)
    .filter(type => (interior ? isInteriorFurniture(type) : isHeroConstructionBuildingType(type)))
    .map(type => menu.getActionBuildingButton(type))
}

function groupConstructionButtons(buttons: MenuButtonSpec[], interior: boolean) {
  const categories = interior ? INTERIOR_FURNITURE_CATEGORIES : CONSTRUCTION_CATEGORIES
  const groups = categories.map(category => ({ titleKey: category.titleKey, buttons: [] as MenuButtonSpec[] }))
  for (const button of buttons) {
    const index = categories.findIndex(category => category.types.includes(button.id || ''))
    // Outside, buildings missing from the catalogue still show under Village.
    const group = groups[index] ?? groups.find(candidate => candidate.titleKey === 'constructionCategoryVillage')
    group?.buttons.push(button)
  }
  return groups.filter(group => group.buttons.length)
}

export function renderInventoryConstruction(host: InventoryConstructionHost): void {
  const selection = host.menu.context.controls.heroUnit || host.menu.selection
  host.constructionPanel.textContent = ''
  host.menu.clearActionHotkeys()
  if (!selection) return

  const interior = getActiveInteractionSpace(host.menu.context)?.kind === 'interior'
  const usedKeys = new Set<string>(getReservedGameplayHotkeys())
  const buttons = getInventoryConstructionButtons(host.menu).filter(button => !button.hide || !button.hide())
  for (const group of groupConstructionButtons(buttons, interior)) {
    const section = createInventorySection({
      title: t(group.titleKey),
      presentation: 'recipes',
      renderItems: list => {
        for (const button of group.buttons) {
          const hotkey = host.menu.assignActionHotkey(button.id || '', usedKeys)
          const type = button.id || ''
          const levels = isSowingPlacement(type)
            ? [0]
            : getBuildingLevels(host.menu.context.player.config.buildings[type])
          let remembered = selectedLevels.get(host)
          if (!remembered) selectedLevels.set(host, (remembered = new Map()))
          let level = remembered.get(type) ?? 0
          if (!levels.includes(level)) level = 0
          let row: HTMLElement | undefined
          const render = (): void => {
            const actionButton = createInventoryConstructionActionButton(
              host,
              host.menu.getActionBuildingButton(type, null, level)
            )
            const next = createInventoryConstructionRow(
              host,
              selection,
              actionButton,
              buttons.indexOf(button),
              hotkey,
              level,
              levels.length > 1
            )
            if (row) {
              row.replaceChildren(...Array.from(next.childNodes))
              row.title = next.title
              row.setAttribute('aria-label', next.getAttribute('aria-label') || '')
            } else {
              row = next
              list.appendChild(row)
            }
            if (levels.length > 1)
              attachVariantRow(row, {
                index: levels.indexOf(level),
                count: levels.length,
                onChange: index => {
                  level = levels[index]
                  remembered.set(type, level)
                  render()
                },
              })
            bindConstructionHotkey(host, selection, actionButton, hotkey)
          }
          render()
        }
      },
    })
    host.constructionPanel.appendChild(section)
  }
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
      // Keyboard and gamepad activation have no pointer position of their own.
      if (!evt || ('detail' in evt && evt.detail === 0)) {
        const { controls, gamebox } = host.menu.context
        const rect = gamebox.getBoundingClientRect()
        controls.mouse.x = rect.left + rect.width / 2
        controls.mouse.y = rect.top + rect.height / 2
      }
      button.onClick?.(target, evt)
      if (host.menu.context.controls.mouseBuilding) host.close()
    },
  }
}

function resolveMenuDetails(source?: MenuDetailsSource): MenuDetails | null {
  if (!source) return null
  return typeof source === 'function' ? source() : source
}

function isDetailsCostMetaLine(meta: string, costPrefix: string): boolean {
  return meta.trim().toLowerCase().startsWith(costPrefix)
}

function createInventoryConstructionRow(
  host: InventoryConstructionHost,
  selection: RuntimeEntity,
  button: MenuButtonSpec,
  index: number,
  _hotkey: string | null,
  level = 0,
  hasVariants = false
): HTMLElement {
  const disabled = button.disabled?.(selection) ?? false
  const details = resolveMenuDetails(button.details)
  const { player } = host.menu.context
  const config = button.id ? getPlayerBuildingConfig(player, button.id, level) : undefined
  const sowing = isSowingPlacement(button.id ?? '')
  const costMetaParts = config?.cost
    ? sowing
      ? [{ text: t('constructionSowingCost'), className: '' }]
      : [{ constructionSite: { config, level, cost: config.cost } }]
    : []
  const detailsCostPrefix = t('detailsCost', { cost: '' }).trim().toLowerCase()
  const detailsHpPrefix = t('detailsBuildingHP', { value: '' }).trim().toLowerCase()
  const detailsMeta = (details?.meta ?? [])
    .filter((meta): meta is string => typeof meta === 'string' && meta.length > 0)
    .filter(meta => !isDetailsCostMetaLine(meta, detailsCostPrefix))
    .filter(meta => !isDetailsCostMetaLine(meta, detailsHpPrefix))
  const { element, icon } = createInventoryActionRow({
    id: button.id || `construction-${index}`,
    className: 'inventory-construction-row',
    disabled,
    title: hasVariants
      ? t('constructionVariantTitle', { name: details?.title ?? t(button.id || ''), level: level + 1 })
      : (details?.title ?? t(button.id || '')),
    description: details?.description,
    meta: detailsMeta.join(' | '),
    metaParts: costMetaParts,
    trailingAction: {
      label: t(sowing ? 'inventorySowAction' : 'inventoryPlaceSiteAction'),
      disabled,
      onClick: evt => {
        if (button.disabled?.(selection)) return
        button.onClick?.(selection, evt)
      },
    },
  })
  renderConstructionButtonAvatar(host.menu, icon, button, level)

  return element
}

function renderConstructionButtonAvatar(
  menu: MenuHost,
  icon: HTMLElement,
  button: MenuButtonSpec,
  level: number
): void {
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
      : renderBuildingAvatar(app, button.id, { ...player, level }, canvas)
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
    button.onClick!(selection, null)
  })
}
