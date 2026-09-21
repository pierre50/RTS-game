import { BUILDING_TYPES, CAMP_DECORATION_BUILDING_TYPES, FAMILY_TYPES, SHEET_TYPES } from '../constants'
import { isHeroInteractionTargetReachable } from '../lib/hero/heroActionRange'
import {
  resolveHeroNpcProximityInteraction,
  wakeOwnSleepingNpcForCommunication,
} from '../lib/hero/heroProximityInteractions'
import { transferNeutralEntityToPlayer } from '../lib/entities/entityOwnerTransfer'
import { findFacingEntity } from '../lib/hero/heroTools'
import type { GameContextLike } from '../types/context'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../types/entities'

type HeroInteractionHost = {
  context: GameContextLike
  heroUnit: UnitEntity | null
  isHeroControlActive(): boolean
}

function isCorpseInteractionTarget(target: RuntimeEntity): boolean {
  return Boolean(
    target.family === FAMILY_TYPES.unit && (target.isDead || (target as UnitEntity).currentSheet === SHEET_TYPES.corpse)
  )
}

export class HeroInteractionController {
  host: HeroInteractionHost

  constructor(host: HeroInteractionHost) {
    this.host = host
  }

  getFacingEntityTarget(): RuntimeEntity | null {
    const hero = this.host.heroUnit
    if (!hero) return null
    return findFacingEntity(hero, target => isHeroInteractionTargetReachable(hero, null, target))
  }

  closeAnyHeroPanel(): boolean {
    const menu = this.host.context.menu
    if (menu?.isNpcOrdersOpen?.()) {
      menu.closeNpcOrders?.()
      return true
    }
    if (menu?.isHeroBuildingMenuOpen?.()) {
      menu.closeHeroBuildingMenu?.()
      return true
    }
    if (menu?.isEntityInfoModalOpen?.()) {
      menu.closeEntityInfoModal?.()
      return true
    }
    return false
  }

  openHeroEntityInteraction(target: RuntimeEntity | null = this.getFacingEntityTarget()): boolean {
    if (!this.host.isHeroControlActive()) return false

    const menu = this.host.context.menu
    if (this.closeAnyHeroPanel()) return true
    if (!target) return false

    const hero = this.host.heroUnit
    if (target === hero) return false

    const player = this.host.context.player
    if (target.family === FAMILY_TYPES.building) {
      const building = target as BuildingEntity
      if (
        building.type === BUILDING_TYPES.trap ||
        CAMP_DECORATION_BUILDING_TYPES.some(type => type === building.type)
      )
        return false
      if (player) transferNeutralEntityToPlayer(building, player, { player })
      if (menu?.openHeroBuildingMenu?.(building)) {
        player?.unselectAll?.()
        building.select?.()
        player.selectedBuilding = building
        return true
      }
      if (building.owner === player) return false
    }

    if (!hero || !isHeroInteractionTargetReachable(hero, null, target)) return false

    if (isCorpseInteractionTarget(target)) {
      return Boolean(menu?.openEntityInfoModal?.(target))
    }

    const npcInteraction = resolveHeroNpcProximityInteraction(hero, target)
    if (npcInteraction) {
      transferNeutralEntityToPlayer(npcInteraction.target, hero.owner, { player: hero.owner })
      wakeOwnSleepingNpcForCommunication(hero, npcInteraction.target)
      menu?.openNpcOrders?.([npcInteraction.target], npcInteraction.npcOptions)
      return true
    }

    // Living characters only support communication; living animals use their dedicated interactions.
    if (target.family === FAMILY_TYPES.unit || (target.family === FAMILY_TYPES.animal && !target.isDead))
      return false

    return Boolean(menu?.openEntityInfoModal?.(target))
  }
}
