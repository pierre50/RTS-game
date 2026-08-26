import { Graphics } from 'pixi.js'
import { getReliefOffset } from '../lib'
import { LABEL_TYPES } from '../constants'
import { heroCanCommand } from '../lib/chief'
import {
  COMM_INDICATOR_DELAY_MS,
  getCommRadiusForHold,
  releaseIfStillLooking,
  resolveCommGroup,
  sendNpcGroupToTarget,
} from '../lib/npc/npcInteraction'
import type { NpcOrdersOpenOptions } from '../types/context'
import type { UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import { drawCommIndicatorCells } from './HeroControllerSupport'

type HeroCommunicationHost = {
  commChargeStart: number
  commCharging: boolean
  commIndicator: Graphics | null
  controls: {
    context: { menu?: { openNpcOrders?: (npcs: UnitEntity[], options?: NpcOrdersOpenOptions) => void } }
    getCellUnderCursor(): RuntimeCell | null
    getWorldPointUnderCursor(): { x: number; y: number }
    openHeroEntityInteraction(): boolean
  }
  heroUnit: UnitEntity | null
  pendingGoToNpcs: UnitEntity[] | null
}

export function beginHeroCommCharge(controller: HeroCommunicationHost): void {
  const hero = controller.heroUnit
  if (!hero || controller.commCharging) return
  if (!heroCanCommand(hero)) return
  controller.commCharging = true
  controller.commChargeStart = performance.now()
  const indicator = new Graphics()
  indicator.label = LABEL_TYPES.commRadius
  indicator.zIndex = -1
  hero.addChildAt(indicator, 0)
  controller.commIndicator = indicator
}

export function updateHeroCommIndicator(controller: HeroCommunicationHost): void {
  const indicator = controller.commIndicator
  const hero = controller.heroUnit
  if (!indicator || !hero) return
  indicator.position.y = getReliefOffset(hero)
  const elapsed = performance.now() - controller.commChargeStart
  indicator.clear()
  if (elapsed < COMM_INDICATOR_DELAY_MS) return
  const radius = getCommRadiusForHold(elapsed)
  drawCommIndicatorCells(indicator, hero, radius)
}

export function endHeroCommCharge(controller: HeroCommunicationHost): void {
  const hero = controller.heroUnit
  const elapsed = performance.now() - controller.commChargeStart
  cancelHeroCommCharge(controller)
  if (!hero) return
  const precisionOnly = elapsed < COMM_INDICATOR_DELAY_MS
  const radius = precisionOnly ? 0 : getCommRadiusForHold(elapsed)
  const group = resolveCommGroup(hero, radius, { precisionOnly })
  if (group.length) {
    controller.controls.context.menu?.openNpcOrders?.(group)
    return
  }
  if (precisionOnly) controller.controls.openHeroEntityInteraction()
}

export function cancelHeroCommCharge(controller: HeroCommunicationHost): void {
  controller.commCharging = false
  if (controller.commIndicator) {
    controller.commIndicator.parent?.removeChild(controller.commIndicator)
    controller.commIndicator.destroy(true)
    controller.commIndicator = null
  }
}

export function beginHeroGoToPicking(controller: HeroCommunicationHost, npcs: UnitEntity[]): void {
  controller.pendingGoToNpcs = npcs
}

export function cancelHeroGoToPicking(controller: HeroCommunicationHost): void {
  const npcs = controller.pendingGoToNpcs
  controller.pendingGoToNpcs = null
  if (npcs?.length) releaseIfStillLooking(npcs)
}

export function resolveHeroGoTo(controller: HeroCommunicationHost): void {
  const npcs = controller.pendingGoToNpcs
  controller.pendingGoToNpcs = null
  if (!npcs?.length) return
  const cell = controller.controls.getCellUnderCursor()
  if (cell) sendNpcGroupToTarget(npcs, cell, controller.controls.getWorldPointUnderCursor())
  else releaseIfStillLooking(npcs)
}
