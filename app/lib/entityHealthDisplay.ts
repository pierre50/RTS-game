import { MENU_INFO_IDS } from '../constants'
import { formatHitPointsText } from './hitPointsText'
import type { MenuLike } from '../types/context'
import type { RuntimeEntity } from '../types/entities'
import type { PlayerLike } from '../types/player'

export type EntityHealthDisplayOptions = {
  emptyWhenDepleted?: boolean
  forceInfo?: boolean
  menu?: MenuLike | null
  player?: PlayerLike | null
}

function shouldShowEntityHealthBar(entity: RuntimeEntity): boolean {
  return Boolean(entity.selected || entity.shouldKeepHealthBarVisible?.())
}

function isEntitySelectedForInfo(entity: RuntimeEntity, player?: PlayerLike | null): boolean {
  return Boolean(
    player?.selectedUnit === entity || player?.selectedBuilding === entity || player?.selectedOther === entity
  )
}

export function getEntityHitPointsText(
  entity: RuntimeEntity,
  options: Pick<EntityHealthDisplayOptions, 'emptyWhenDepleted'> = {}
): string {
  if (options.emptyWhenDepleted && (entity.hitPoints ?? 0) <= 0) return ''
  return formatHitPointsText(entity.hitPoints ?? 0, entity.totalHitPoints ?? 0)
}

export function syncEntityHealthDisplay(entity: RuntimeEntity, options: EntityHealthDisplayOptions = {}): void {
  if (shouldShowEntityHealthBar(entity)) {
    entity.drawHealthBar?.()
    entity.drawEnergyBar?.()
  }

  if (options.menu && (options.forceInfo || isEntitySelectedForInfo(entity, options.player))) {
    options.menu.updateInfo?.(MENU_INFO_IDS.hitPoints, getEntityHitPointsText(entity, options))
  }
}
