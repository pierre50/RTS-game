import { ACTION_TYPES, SHEET_TYPES } from '../../constants'
import {
  isBanditOwner,
  playAudibleSoundCue,
  showConversionFeedback,
  syncMovedActionTarget,
} from '../../lib'
import { grantUnitXp, XP_CATEGORIES, XP_CONVERT_SUCCESS } from '../../lib/units/unitExperience'
import { spendOrWaitForEnergy } from '../../lib/units/unitEnergy'
import { isConvertibleEntity, transferEntityOwner } from '../../lib/entities/entityOwnerTransfer'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'

const BASE_CONVERSION_MIN_CHANTS = 3
const BASE_CONVERSION_CHANCE = 0.3
const ASTROLOGY_CONVERSION_CHANCE = 0.39

function isRuntimeEntity(value: UnitEntity['dest'] | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

const lastConversionDebugAt = new Map<string, number>()

function debugConversionFailure(
  converter: UnitEntity,
  target: RuntimeEntity,
  reason: string,
  details: Record<string, unknown> = {}
): void {
  if (!converter.owner?.isPlayed) return
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const key = `${converter.label ?? 'converter'}:${target.label ?? 'target'}:${reason}`
  const last = lastConversionDebugAt.get(key) ?? 0
  if (now - last < 600) return
  lastConversionDebugAt.set(key, now)
  console.warn('[conversion]', reason, {
    converter: {
      label: converter.label,
      type: converter.type,
      owner: converter.owner?.label,
      action: converter.action,
    },
    target: {
      label: target.label,
      type: target.type,
      family: target.family,
      owner: target.owner?.label,
      hitPoints: target.hitPoints,
      isDead: target.isDead,
      isDestroyed: target.isDestroyed,
    },
    ...details,
  })
}

export class UnitConversionAction {
  unit: UnitEntity

  constructor(unit: UnitEntity) {
    this.unit = unit
  }

  playConversionSound(): void {
    const unit = this.unit
    if (!unit.sounds?.convert) return
    playAudibleSoundCue(unit, unit.sounds.convert, { profile: 'voice' })
  }

  getConversionRules() {
    const technologies = this.unit.owner?.technologies || []
    return technologies.includes('Astrology')
      ? { minChants: BASE_CONVERSION_MIN_CHANTS, chance: ASTROLOGY_CONVERSION_CHANCE }
      : { minChants: BASE_CONVERSION_MIN_CHANTS, chance: BASE_CONVERSION_CHANCE }
  }

  convertTarget(target: RuntimeEntity, options: { grantXp?: boolean; stopConverter?: boolean } = {}): boolean {
    const unit = this.unit
    const grantXpOnSuccess = options.grantXp ?? true
    const stopConverter = options.stopConverter ?? true
    const menu = unit.context?.menu
    const player = unit.owner
    if (!isConvertibleEntity(target)) {
      debugConversionFailure(unit, target, 'target-not-convertible')
      return false
    }
    const oldOwner = target.owner
    const newOwner = unit.owner
    if (!oldOwner || !newOwner || oldOwner.label === newOwner.label) {
      debugConversionFailure(unit, target, 'invalid-owner', {
        oldOwner: oldOwner?.label,
        newOwner: newOwner?.label,
      })
      return false
    }
    if (isBanditOwner(newOwner)) {
      debugConversionFailure(unit, target, 'bandit-owner-cannot-convert', {
        newOwner: newOwner.label,
      })
      return false
    }
    if (!transferEntityOwner(target, newOwner, { menu, player, showConversionFeedback })) return false
    if (grantXpOnSuccess) grantUnitXp(unit, XP_CATEGORIES.healing, XP_CONVERT_SUCCESS)
    if (stopConverter) unit.stop?.()
    return true
  }

  handleConvertAction() {
    const unit = this.unit
    const map = unit.context?.map
    const sprite = unit.sprite
    if (!sprite) return
    if (!unit.getActionCondition?.(unit.dest)) {
      const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
      if (dest) debugConversionFailure(unit, dest, 'action-condition-failed', { stage: 'start' })
      unit.affectNewDest?.()
      return
    }
    unit.conversionChants = 0
    unit.setTextures?.(SHEET_TYPES.action)
    sprite.onLoop = () => {
      const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
      if (!unit.getActionCondition?.(dest)) {
        if (dest) debugConversionFailure(unit, dest, 'action-condition-failed', { stage: 'loop' })
        unit.affectNewDest?.()
        return
      }
      syncMovedActionTarget(unit, dest)
      if (!unit.isUnitAtDest?.(unit.action, dest)) {
        unit.sendToEvt?.(dest ?? null, ACTION_TYPES.convert, { forceRepath: true })
        return
      }

      if (!spendOrWaitForEnergy(unit, unit.action, dest)) return
      this.playConversionSound()
      unit.conversionChants = (unit.conversionChants || 0) + 1
      const { minChants, chance } = this.getConversionRules()
      if (unit.conversionChants >= minChants && map && map.random() < chance && dest) {
        this.convertTarget(dest)
      }
    }
  }
}
