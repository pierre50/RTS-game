import { SHEET_TYPES } from '../constants'
import { getHeroAimDegree } from '../lib/hero/heroTools'
import type { UnitEntity } from '../types/entities'
import type { HeroAimPoint } from './HeroControllerSupport'

export function faceHeroPoint(unit: UnitEntity | null, point: HeroAimPoint): void {
  if (!unit || unit.actionLocked) return
  const aimDegree = getHeroAimDegree(unit, point)
  if (unit.degree !== aimDegree) {
    unit.degree = aimDegree
    if (unit.owner) unit.context?.menu?.updatePlayerMiniMap?.(unit.owner)
    unit.setTextures?.(unit.currentSheet === SHEET_TYPES.walking ? SHEET_TYPES.walking : SHEET_TYPES.standing)
  }
}
