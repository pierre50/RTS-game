import { t } from '../../lib/lang'
import { depotReserveResources, reserveAmounts, setReserveShare } from '../../lib/economy/depotReserves'
import { settlementDepotPolicy, setSettlementDepotPolicy } from '../../lib/economy/collectiveTasks'
import type { BuildingEntity } from '../../types/entities'
import type { MenuHost } from '../MenuHost'

export function createHeroDepotReservesBody(
  building: BuildingEntity,
  menu: MenuHost,
  refresh: () => void
): HTMLElement | null {
  const owner = building.owner
  if (
    !owner ||
    !building.isBuilt ||
    !['StoragePit', 'Granary'].includes(building.type) ||
    (owner !== menu.context.player && owner.label !== menu.context.player.label)
  )
    return null
  const policy = settlementDepotPolicy(owner, building)
  const targets = reserveAmounts(policy, building.type)
  const panel = document.createElement('div')
  panel.className = 'depot-reserves'
  const help = document.createElement('p')
  help.textContent = t('depotReservesHelp')
  panel.appendChild(help)
  const capacity = document.createElement('p')
  capacity.className = 'depot-reserve-capacity'
  capacity.textContent = t('depotReserveCapacity', { count: policy.target })
  panel.appendChild(capacity)
  for (const resource of depotReserveResources(building.type)) {
    const row = document.createElement('div')
    row.className = 'depot-reserve-row config-row'
    const label = document.createElement('label')
    label.textContent = t(resource)
    label.htmlFor = `depot-reserve-${resource}`
    row.appendChild(label)
    const input = document.createElement('input')
    input.id = `depot-reserve-${resource}`
    input.type = 'range'
    input.className = 'ui-range'
    input.min = '0'
    input.max = '100'
    input.step = '5'
    input.value = String(policy.shares[resource] ?? 0)
    input.setAttribute('aria-label', t(resource))
    input.setAttribute('aria-valuetext', t('depotReserveAmount', { count: targets[resource] ?? 0 }))
    input.addEventListener('change', () => {
      const value = policy.shares[resource] === 100 && Number(input.value) < 100 ? 0 : Number(input.value)
      setSettlementDepotPolicy(owner, building, setReserveShare(policy, resource, value, building.type))
      refresh()
    })
    row.appendChild(input)
    const amount = document.createElement('output')
    amount.className = 'depot-reserve-amount window-range-value'
    input.dataset.windowValue = String(targets[resource] ?? 0)
    amount.textContent = String(targets[resource] ?? 0)
    row.appendChild(amount)
    panel.appendChild(row)
  }
  return panel
}
