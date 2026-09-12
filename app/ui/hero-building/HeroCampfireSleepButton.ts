import {
  canHeroSleepAtFireCamp,
  getHeroCampfireSleepBlockedReason,
  getHostileInHeroSight,
  sleepHeroAtFireCamp,
} from '../../lib/hero/heroCampfireSleep'
import { t } from '../../lib/lang'
import type { MenuHost } from '../MenuHost'
import type { BuildingEntity } from '../../types/entities'
import type { MenuButtonSpec } from '../../types/ui'

export function heroCampfireSleepButton(menu: MenuHost, building: BuildingEntity, close: () => void): MenuButtonSpec {
    return {
      id: 'heroCampfireSleep',
      disabled: () => !canHeroSleepAtFireCamp(menu.context.controls.heroUnit, building),
      details: () => {
        const hero = menu.context.controls.heroUnit
        const reason = getHeroCampfireSleepBlockedReason(hero, building)
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
        if (sleepHeroAtFireCamp(menu.context.controls.heroUnit, building)) close()
      },
    }
}
