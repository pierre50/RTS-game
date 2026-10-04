import { setHeroHome } from '../../lib/housing/heroHome'
import { canClaimHeroHome, reconcileHouseholds } from '../../lib/housing/households'
import { t } from '../../lib/lang'
import type { BuildingEntity } from '../../types/entities'
import type { MenuButtonSpec } from '../../types/ui'
import type { MenuHost } from '../MenuHost'

export function heroHomeButton(menu: MenuHost, house: BuildingEntity, refresh: () => void): MenuButtonSpec {
  const available = () => {
    const hero = menu.context.controls.heroUnit
    return !!hero && hero.owner === house.owner && !!hero.owner && canClaimHeroHome(hero.owner, hero, house)
  }
  return {
    id: 'heroSetHome',
    disabled: () => !available(),
    details: () => ({
      title: t(menu.context.controls.heroUnit?.homeHouseLabel === house.label ? 'heroCurrentHome' : 'heroSetHome'),
    }),
    onClick: () => {
      const hero = menu.context.controls.heroUnit
      if (!available() || !hero?.owner || !setHeroHome(menu.context, hero, house)) return
      reconcileHouseholds(hero.owner)
      refresh()
    },
  }
}
