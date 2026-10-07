import {
  canManageVillageResearch,
  canResearchVillageUpgrade,
  researchVillageUpgrade,
} from '../../lib/equipment/villageResearch'
import {
  FORGE_FAMILIES,
  FORGE_ICONS,
  FORGE_MATERIALS,
  getForgeTier,
  getForgeUpgradeCost,
  type ForgeFamily,
} from '../../lib/equipment/forgeUpgrades'
import { t } from '../../lib/lang'
import { getPlayerResourceTotals } from '../../lib/resources/playerResourceTotals'
import type { BuildingEntity } from '../../types/entities'
import type { MenuHost } from '../MenuHost'
import { createInventoryActionRow } from '../inventory/InventoryActionRow'
import { inventoryCostMetaParts } from '../inventory/InventoryCostMeta'
import { createInventoryEquipmentIcon } from '../inventory/InventoryItemIcons'

/** All tiers remain visible so prerequisites can be read without buying a research. */
export function createHeroTechnologyBody(building: BuildingEntity, menu: MenuHost, refresh: () => void): HTMLElement {
  const panel = document.createElement('section')
  panel.className = 'technology-tree'
  const heading = document.createElement('h3')
  heading.textContent = t('technologyTitle')
  const scope = document.createElement('p')
  scope.textContent = t('forgeUpgradeScope')
  panel.append(heading, scope)
  for (const [title, families] of [
    ['forgeCategoryTools', FORGE_FAMILIES.slice(0, 3)],
    ['forgeCategoryMilitary', FORGE_FAMILIES.slice(3)],
  ] as const) {
    const group = document.createElement('section')
    group.className = 'technology-group'
    const label = document.createElement('h4')
    label.textContent = t(title)
    group.appendChild(label)
    for (const family of families) group.appendChild(createBranch(family))
    panel.appendChild(group)
  }
  return panel

  function createBranch(family: ForgeFamily): HTMLElement {
    const { player, controls } = menu.context
    const current = getForgeTier(player, family)
    const branch = document.createElement('section')
    branch.className = 'technology-branch'
    const title = document.createElement('h5')
    title.textContent = t(`forgeFamily_${family}`)
    const effect = document.createElement('p')
    effect.textContent = t(`forgeEffect_${family}`)
    const nodes = document.createElement('ol')
    nodes.className = 'technology-nodes'
    branch.append(title, effect, nodes)
    FORGE_MATERIALS.forEach((material, tier) => {
      const acquired = tier <= current
      const next = tier === current + 1
      const available = next && canResearchVillageUpgrade(player, building, family, controls.heroUnit)
      const prerequisite = t('technologyPrerequisite', {
        material: t(`forgeMaterial_${FORGE_MATERIALS[Math.max(0, tier - 1)]}`),
      })
      const reason = !canManageVillageResearch(player, building, controls.heroUnit)
        ? t('forgeUpgradeRequiresCommand')
        : t('forgeResourcesMissing')
      const node = document.createElement('li')
      node.className = `technology-node ${acquired ? 'is-acquired' : next ? 'is-next' : 'is-locked'}`
      const { element, icon } = createInventoryActionRow(menu, {
        id: `technology-${family}-${tier}`,
        title: t(`forgeMaterial_${material}`),
        badge: t(acquired ? 'technologyAcquired' : next ? 'technologyNext' : 'technologyLocked'),
        description: acquired ? '' : `${prerequisite}${next && !available ? ` · ${reason}` : ''}`,
        metaParts: acquired
          ? []
          : inventoryCostMetaParts(
              getForgeUpgradeCost(family, tier),
              getPlayerResourceTotals(player, { includeHero: false })
            ),
        trailingAction: acquired
          ? undefined
          : {
              label: t('technologyResearch'),
              ariaLabel: `${t('technologyResearch')} : ${t(`forgeFamily_${family}`)} — ${t(`forgeMaterial_${material}`)}`,
              disabled: !available,
              title: !next ? prerequisite : !available ? reason : undefined,
              onClick: () => {
                const success = researchVillageUpgrade(player, building, family, tier, controls.heroUnit)
                menu.showMessage(
                  success
                    ? t('forgeUpgradeSuccess', {
                        item: `${t(`forgeFamily_${family}`)} — ${t(`forgeMaterial_${material}`)}`,
                      })
                    : t('forgeUpgradeUnavailable'),
                  success ? 'success' : 'warning'
                )
                if (success) menu.updateTopbar?.()
                refresh()
                const nextButton =
                  document.querySelector<HTMLButtonElement>(
                    `#technology-${family}-${tier + 1} button:not(:disabled)`
                  ) ?? document.querySelector<HTMLButtonElement>('.technology-tree button:not(:disabled)')
                nextButton?.focus()
              },
            },
      })
      icon.appendChild(createInventoryEquipmentIcon(menu.context, `${FORGE_ICONS[family]}_${material}`, 'craft'))
      node.appendChild(element)
      nodes.appendChild(node)
    })
    return branch
  }
}
