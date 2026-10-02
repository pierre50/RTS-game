import {
  canHeroSleepAtTarget,
  getHeroSleepBlockedReason,
  getHostileInHeroSight,
  sleepHeroAtTarget,
} from '../../lib/hero/heroSleep'
import { t } from '../../lib/lang'
import type { MenuHost } from '../MenuHost'
import type { BuildingEntity } from '../../types/entities'
import type { MenuButtonSpec } from '../../types/ui'

export function heroSleepButton(menu: MenuHost, building: BuildingEntity, close: () => void): MenuButtonSpec {
  return {
    id: 'heroCampfireSleep',
    disabled: () => !canHeroSleepAtTarget(menu.context.controls.heroUnit, building),
    details: () => {
      const hero = menu.context.controls.heroUnit
      const reason = getHeroSleepBlockedReason(hero, building)
      const hostile = hero && reason === 'heroCampfireSleepBlockedDescription' ? getHostileInHeroSight(hero) : null
      return {
        title: t('heroCampfireSleep'),
        description: hostile
          ? t('heroCampfireSleepBlockedBy', {
              target: t(hostile.type ?? hostile.label),
              owner: hostile.owner?.name ?? hostile.owner?.label ?? '',
            })
          : t(reason ?? 'heroCampfireSleepDescription'),
      }
    },
    onClick: () => {
      if (sleepHeroAtTarget(menu.context.controls.heroUnit, building)) close()
    },
  }
}
