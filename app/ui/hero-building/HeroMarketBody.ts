import { definedProperties } from '../../lib/definedProperties'
import { RESOURCE_STORAGE_NAMES } from '../../constants'
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
import { createInventoryEquipmentRow, createInventoryResourceRow } from '../inventory/InventoryItemRows'
import { createInventorySection } from '../inventory/InventorySection'
import { formatGold } from '../inventory/InventoryDetails'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { MenuHost } from '../MenuHost'
import type { GameContextLike } from '../../types/context'
import type { PlayerLike } from '../../types/player'

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

export function canHeroTradeAtMarket(building: BuildingEntity, hero: UnitEntity | null | undefined): boolean {
  if (!hero || building.isBuilt === false || building.isDead || building.isDestroyed) return false
  const heroOwner = hero.owner
  const marketOwner = building.owner
  if (!heroOwner || !marketOwner || heroOwner.label === marketOwner.label) return true
  if (heroOwner.isEnemy?.(marketOwner) || marketOwner.isEnemy?.(heroOwner)) return false
  return !hasBlockedFactionRelation(marketOwner, hero.context ?? building.context)
}

function handleMarketChange(menu: MenuHost, onChange: () => void): void {
  menu.playUiClick()
  menu.refreshInventory?.()
  onChange()
}

function getMarketActionLabel(action: 'buy' | 'sell', goldValue: number, count: number): string {
  const key =
    action === 'buy'
      ? count > 1
        ? 'marketBuyActionEach'
        : 'marketBuyAction'
      : count > 1
        ? 'marketSellActionEach'
        : 'marketSellAction'
  return t(key, { gold: formatGold(goldValue) })
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
    definedProperties({ age: Math.min(marketOwner?.age ?? 0, hero.owner?.age ?? 0), civilization: marketOwner?.civ }),
    marketStock
  )) {
    const label = formatEquipmentStackLabel(offer.equipment, offer.count)
    const totalGold = offer.goldValue * offer.count
    const disabled = heroGold < offer.goldValue
    const { element } = createInventoryEquipmentRow(menu.context, menu, {
      id: `market-buy-${offer.equipment}`,
      className: 'inventory-loot-slot market-slot market-buy-slot',
      disabled,
      equipment: offer.equipment,
      count: offer.count,
      mode: 'market-buy',
      showValue: false,

      labelContext: 'market',
      trailingAction: {
        ariaLabel: t('marketBuyItem', { item: label, gold: String(totalGold) }),
        disabled,
        label: getMarketActionLabel('buy', offer.goldValue, offer.count),
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
      },
    })
    element.setAttribute('aria-label', t('marketBuyItem', { item: label, gold: String(totalGold) }))
    grid.appendChild(element)
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
    const totalGold = goldValue * amount
    const { element } = createInventoryResourceRow(menu, {
      id: `market-sell-resource-${resource}`,
      className: 'inventory-loot-slot market-slot market-sell-slot',
      resource,
      amount,
      mode: 'market-sell',
      showValue: false,

      trailingAction: {
        ariaLabel: t('marketSellItem', { item: label, gold: String(totalGold) }),
        label: getMarketActionLabel('sell', goldValue, amount),
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
      },
    })
    element.setAttribute('aria-label', t('marketSellItem', { item: label, gold: String(totalGold) }))
    grid.appendChild(element)
  }
}

function appendSellEquipmentSlots(grid: HTMLDivElement, hero: UnitEntity, menu: MenuHost, onChange: () => void): void {
  for (const stack of getEquipmentStacks(hero.inventory?.equipment ?? [])) {
    const goldValue = getEquipmentResaleGoldValue(stack.equipment)
    if (goldValue <= 0) continue
    const label = formatEquipmentStackLabel(stack.equipment, stack.count)
    const totalGold = goldValue * stack.count
    const { element } = createInventoryEquipmentRow(menu.context, menu, {
      id: `market-sell-equipment-${stack.equipment}`,
      className: 'inventory-loot-slot market-slot market-sell-slot',
      equipment: stack.equipment,
      count: stack.count,
      mode: 'market-sell',

      labelContext: 'market',
      trailingAction: {
        ariaLabel: t('marketSellItem', { item: label, gold: String(totalGold) }),
        label: getMarketActionLabel('sell', goldValue, stack.count),
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
      },
    })
    element.setAttribute('aria-label', t('marketSellItem', { item: label, gold: String(totalGold) }))
    grid.appendChild(element)
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
  panel.className = 'hero-market-panel inventory-transfer-panel'
  panel.dataset.marketBuilding = building.label ?? building.type

  const wallet = document.createElement('div')
  wallet.className = 'hero-market-wallet'
  wallet.textContent = t('marketHeroGold', { gold: String(getHeroGold(hero)) })
  panel.appendChild(wallet)

  panel.appendChild(
    createInventorySection({
      className: 'market-section',
      gridClassName: 'inventory-section-list market-grid',
      title: t('marketStockTitle'),
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
      gridClassName: 'inventory-section-list market-grid',
      title: t('inventoryYourBag'),
      titleClassName: 'market-title',
      renderItems: grid => {
        appendSellResourceSlots(grid, hero, menu, onChange)
        appendSellEquipmentSlots(grid, hero, menu, onChange)
      },
    })
  )

  return panel
}
