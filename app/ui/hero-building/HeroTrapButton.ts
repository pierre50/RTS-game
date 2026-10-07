import { isHeroInteractionTargetReachable } from '../../lib/hero/heroActionRange'
import { instanceIsInActiveOrTeamSight } from '../../lib/grid/visibility'
import { t } from '../../lib/lang'
import { dismantleTrapBuilding } from '../../services/world/TrapHarvestSystem'
import type { BuildingEntity } from '../../types/entities'
import type { MenuButtonSpec } from '../../types/ui'
import type { MenuHost } from '../MenuHost'

export function heroTrapButton(menu: MenuHost, building: BuildingEntity, close: () => void): MenuButtonSpec {
  const available = () => {
    const hero = menu.context.controls.heroUnit
    return Boolean(
      hero &&
        building.isBuilt &&
        !building.isDead &&
        !building.isDestroyed &&
        isHeroInteractionTargetReachable(hero, null, building) &&
        (!building.requiresActiveSightInteraction ||
          instanceIsInActiveOrTeamSight(building, menu.context.player, menu.context.players))
    )
  }
  return {
    id: 'heroInteractionDismantle',
    disabled: () => !available(),
    details: () => ({ title: t('heroInteractionDismantle'), description: t('trapDismantleDescription') }),
    onClick: () => {
      if (available() && dismantleTrapBuilding(menu.context.controls.heroUnit, building)) close()
    },
  }
}
