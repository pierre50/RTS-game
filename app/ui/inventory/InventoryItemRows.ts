import { appendInventoryEmptyIcon, createInventoryActionRow, type InventoryActionRowParts } from './InventoryActionRow'
import { createInventoryEquipmentIcon, createInventoryResourceIcon } from './InventoryItemIcons'
import { createEquipmentRowInfo, createResourceRowInfo, formatGold } from './InventoryDetails'
import type { ResourceAmount } from '../../types/common'
import type { GameContextLike } from '../../types/context'
import type { MenuHost } from '../MenuHost'

type InventoryItemRowMenu = MenuHost | GameContextLike['menu']

type BaseInventoryItemRowOptions = {
  showValue?: boolean
  ariaLabel?: string
  badge?: string
  className?: string
  description?: string
  descriptionPrefix?: string
  disabled?: boolean
  icon?: HTMLElement
  id: string
  labelContext?: string
  playClick?: boolean
  meta?: string
  title?: string
  secondaryAction?: Parameters<typeof createInventoryActionRow>[1]['secondaryAction']
  trailingAction?: Parameters<typeof createInventoryActionRow>[1]['trailingAction']
}

type EquipmentItemRowOptions = BaseInventoryItemRowOptions & {
  count?: number
  equipment: string
  mode?: Parameters<typeof createEquipmentRowInfo>[2]
}

type ResourceItemRowOptions = BaseInventoryItemRowOptions & {
  amount?: number
  mode?: Parameters<typeof createResourceRowInfo>[2]
  resource: keyof ResourceAmount
}

function getRowDescription(options: BaseInventoryItemRowOptions, fallback: string): string {
  return [options.descriptionPrefix, options.description ?? fallback].filter(Boolean).join(' | ')
}

export type InventoryItemRowParts = InventoryActionRowParts & {
  info: ReturnType<typeof createEquipmentRowInfo> | ReturnType<typeof createResourceRowInfo>
}

export function createInventoryEquipmentRow(
  context: GameContextLike | undefined,
  menu: InventoryItemRowMenu,
  options: EquipmentItemRowOptions
): InventoryItemRowParts {
  const count = options.count ?? 1
  const info = createEquipmentRowInfo(options.equipment, count, options.mode, { showValue: false })
  const parts = createItemRow(menu, options, info, count)
  if (options.icon) {
    parts.icon.appendChild(options.icon)
  } else if (options.equipment && context) {
    parts.icon.appendChild(
      createInventoryEquipmentIcon(context, options.equipment, options.labelContext ?? 'inventory')
    )
  } else {
    appendInventoryEmptyIcon(parts.icon)
  }
  return parts
}

export function createInventoryResourceRow(
  menu: InventoryItemRowMenu,
  options: ResourceItemRowOptions
): InventoryItemRowParts {
  const amount = options.amount ?? 1
  const info = createResourceRowInfo(options.resource, amount, options.mode, { showValue: false })
  const parts = createItemRow(menu, options, info, amount)
  parts.icon.appendChild(options.icon ?? createInventoryResourceIcon(options.resource))
  return parts
}

function createItemRow(menu: InventoryItemRowMenu, options: BaseInventoryItemRowOptions, info: InventoryItemRowParts['info'], quantity: number): InventoryItemRowParts {
  const row = createInventoryActionRow(menu, {
    id: options.id,
    badge: options.badge,
    className: options.className,
    disabled: options.disabled,
    title: options.title ?? info.title,
    description: getRowDescription(options, info.description),
    meta: options.meta ?? info.meta,
    value: options.showValue !== false && info.goldValue > 0 ? formatGold(info.goldValue) : undefined,
    quantity,
    playClick: options.playClick,
    secondaryAction: options.secondaryAction,
    trailingAction: options.trailingAction,
  })
  const parts: InventoryItemRowParts = { ...row, info }
  if (options.ariaLabel) parts.element.setAttribute('aria-label', options.ariaLabel)
  return parts
}
