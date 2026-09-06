import { RESOURCE_ICON_IDS, RESOURCE_STORAGE_NAMES } from '../../constants'
import { getIconPath } from '../../lib'
import { formatEquipmentStackLabel, getEquipmentStacks } from '../../lib/equipment/equipmentLoot'
import {
  buyMarketEquipment,
  ensureMarketEquipmentStock,
  getEquipmentResaleGoldValue,
  getHeroGold,
  getMarketEquipmentOffers,
  getResourceGoldValue,
  sellHeroEquipment,
  sellHeroResource,
} from '../../lib/equipment/equipmentMarket'
import { t } from '../../lib/lang'
import { renderEquipmentAvatarLazy } from '../equipment/EquipmentAvatar'
import { createInventorySection, createInventorySlot } from '../inventory/InventorySlotRenderer'
import { createEquipmentTooltip, createResourceTooltip } from '../inventory/InventoryTooltips'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { MenuHost } from '../MenuHost'
import type { GameContextLike } from '../../types/context'
import type { PlayerLike } from '../../types/player'
import type { ResourceAmount } from '../../types/common'

const BLOCKED_MARKET_RELATIONS = new Set(['hostile', 'wary'])

function hasBlockedFactionRelation(
  owner: PlayerLike | null | undefined,
  context: GameContextLike | null | undefined
): boolean {
  const factionId = owner?.factionId
  if (!factionId) return false
  const relation = context?.getCampaignFactions?.()?.[factionId]?.relationState
  return BLOCKED_MARKET_RELATIONS.has(relation ?? '')
}

function canHeroTradeAtMarket(building: BuildingEntity, hero: UnitEntity | null | undefined): boolean {
  if (!hero) return false
  const heroOwner = hero.owner
  const marketOwner = building.owner
  if (!heroOwner || !marketOwner || heroOwner.label === marketOwner.label) return true
  if (heroOwner.isEnemy?.(marketOwner) || marketOwner.isEnemy?.(heroOwner)) return false
  return !hasBlockedFactionRelation(marketOwner, hero.context ?? building.context)
}

function goldLabel(amount: number): string {
  return `${amount} ${t('goldShort')}`
}

function createGoldBadge(amount: number): HTMLSpanElement {
  const badge = document.createElement('span')
  badge.className = 'market-gold-badge'
  badge.textContent = goldLabel(amount)
  return badge
}

function appendGoldBadge(slot: HTMLButtonElement, amount: number): void {
  slot.appendChild(createGoldBadge(amount))
}

function createEquipmentIcon(hero: UnitEntity, equipment: string, menu: MenuHost): HTMLCanvasElement {
  const icon = document.createElement('canvas')
  icon.className = 'unit-avatar-frame inventory-slot-icon'
  icon.width = 64
  icon.height = 64
  renderEquipmentAvatarLazy(menu.context.app, equipment, icon, 'market', hero.context?.performance)
  return icon
}

function createResourceIcon(resource: keyof ResourceAmount): HTMLImageElement {
  const icon = document.createElement('img')
  icon.className = 'inventory-resource-icon'
  icon.src = getIconPath(RESOURCE_ICON_IDS[resource].commodity)
  icon.alt = ''
  return icon
}

function handleMarketChange(menu: MenuHost, onChange: () => void): void {
  menu.playUiClick()
  menu.refreshInventory?.()
  onChange()
}

function appendBuySlots(
  grid: HTMLDivElement,
  building: BuildingEntity,
  hero: UnitEntity,
  menu: MenuHost,
  onChange: () => void
): void {
  const heroGold = getHeroGold(hero)
  const marketOwner = building.owner ?? hero.owner
  const marketStock = ensureMarketEquipmentStock(building, { age: marketOwner?.age, civilization: marketOwner?.civ })
  for (const offer of getMarketEquipmentOffers(
    { age: marketOwner?.age, civilization: marketOwner?.civ },
    marketStock
  )) {
    const label = formatEquipmentStackLabel(offer.equipment, offer.count)
    const disabled = heroGold < offer.goldValue
    const slot = createInventorySlot({
      ariaLabel: t('marketBuyItem', { item: label, gold: String(offer.goldValue * offer.count) }),
      className: 'inventory-loot-slot market-slot market-buy-slot',
      disabled,
      icon: createEquipmentIcon(hero, offer.equipment, menu),
      label,
      onAction: mode => {
        const amountToBuy = mode === 'one' ? 1 : offer.count
        const bought = buyMarketEquipment(hero, offer.equipment, amountToBuy, marketStock)
        if (bought <= 0) return
        menu.showMessage(
          t('marketBoughtItem', {
            item: formatEquipmentStackLabel(offer.equipment, bought),
            gold: String(offer.goldValue * bought),
          }),
          'success'
        )
        handleMarketChange(menu, onChange)
      },
    })
    menu.menuTooltip.bind(slot, createEquipmentTooltip(offer.equipment, offer.count, 'market-buy'))
    appendGoldBadge(slot, offer.goldValue * offer.count)
    grid.appendChild(slot)
  }
}

function appendSellResourceSlots(grid: HTMLDivElement, hero: UnitEntity, menu: MenuHost, onChange: () => void): void {
  const resources = hero.inventory?.resources ?? {}
  for (const resource of RESOURCE_STORAGE_NAMES) {
    if (resource === 'gold') continue
    const amount = Math.max(0, Math.floor(resources[resource] ?? 0))
    const goldValue = getResourceGoldValue(resource)
    if (amount <= 0 || goldValue <= 0) continue
    const label = `${t(resource)} x${amount}`
    const slot = createInventorySlot({
      ariaLabel: t('marketSellItem', { item: label, gold: String(goldValue * amount) }),
      className: 'inventory-loot-slot market-slot market-sell-slot',
      icon: createResourceIcon(resource),
      label,
      onAction: mode => {
        const amountToSell = mode === 'one' ? 1 : undefined
        const sold = sellHeroResource(hero, resource, amountToSell)
        if (sold <= 0) return
        menu.showMessage(
          t('marketSoldItem', { item: `${t(resource)} x${sold}`, gold: String(goldValue * sold) }),
          'success'
        )
        handleMarketChange(menu, onChange)
      },
    })
    menu.menuTooltip.bind(slot, createResourceTooltip(resource, amount, 'market-sell'))
    appendGoldBadge(slot, goldValue * amount)
    grid.appendChild(slot)
  }
}

function appendSellEquipmentSlots(grid: HTMLDivElement, hero: UnitEntity, menu: MenuHost, onChange: () => void): void {
  for (const stack of getEquipmentStacks(hero.inventory?.equipment ?? [])) {
    const goldValue = getEquipmentResaleGoldValue(stack.equipment)
    if (goldValue <= 0) continue
    const label = formatEquipmentStackLabel(stack.equipment, stack.count)
    const slot = createInventorySlot({
      ariaLabel: t('marketSellItem', { item: label, gold: String(goldValue * stack.count) }),
      className: 'inventory-loot-slot market-slot market-sell-slot',
      icon: createEquipmentIcon(hero, stack.equipment, menu),
      label,
      onAction: mode => {
        const amountToSell = mode === 'one' ? 1 : stack.count
        const sold = sellHeroEquipment(hero, stack.equipment, amountToSell)
        if (sold <= 0) return
        menu.showMessage(
          t('marketSoldItem', {
            item: formatEquipmentStackLabel(stack.equipment, sold),
            gold: String(goldValue * sold),
          }),
          'success'
        )
        handleMarketChange(menu, onChange)
      },
    })
    menu.menuTooltip.bind(slot, createEquipmentTooltip(stack.equipment, stack.count, 'market-sell'))
    appendGoldBadge(slot, goldValue * stack.count)
    grid.appendChild(slot)
  }
}

export function createHeroMarketBody(
  building: BuildingEntity,
  menu: MenuHost,
  onChange: () => void
): HTMLDivElement | null {
  const hero = menu.context.controls.heroUnit
  if (!hero || !canHeroTradeAtMarket(building, hero)) return null

  const panel = document.createElement('div')
  panel.className = 'hero-market-panel'
  panel.dataset.marketBuilding = building.label ?? building.type

  const wallet = document.createElement('div')
  wallet.className = 'hero-market-wallet'
  wallet.textContent = t('marketHeroGold', { gold: String(getHeroGold(hero)) })
  panel.appendChild(wallet)

  panel.appendChild(
    createInventorySection({
      className: 'market-section',
      gridClassName: 'inventory-loot-grid market-grid',
      title: t('marketBuyTitle'),
      titleClassName: 'market-title',
      renderItems: grid => appendBuySlots(grid, building, hero, menu, onChange),
    })
  )

  const sellIntro = document.createElement('div')
  sellIntro.className = 'hero-market-sell-copy'
  sellIntro.textContent = t('marketSellBagDescription')
  panel.appendChild(sellIntro)

  panel.appendChild(
    createInventorySection({
      className: 'market-section',
      emptyText: t('marketSellBagEmpty'),
      gridClassName: 'inventory-loot-grid market-grid',
      title: t('marketSellBagTitle'),
      titleClassName: 'market-title',
      renderItems: grid => {
        appendSellResourceSlots(grid, hero, menu, onChange)
        appendSellEquipmentSlots(grid, hero, menu, onChange)
      },
    })
  )

  return panel
}
