import { getConfiguredActionFrameSequence } from '../animations/actionFrameSequences'
import { getAnimationCycleMs, getUnitSpritesheetAnimationSpeed } from '../animations/animationTiming'
import {
  DEFAULT_UNIT_ENERGY_REGEN_PER_SECOND,
  DEFAULT_UNIT_ENERGY_REGEN_DELAY_MS,
  getBaseActionEnergyCost,
} from '../units/energyRules'
import type { UnitConfig } from '../../types/config'

export type WorkSpriteSheet = {
  animations?: Record<string, unknown[]>
  textures?: Record<string, unknown>
  data?: { animationSpeed?: number }
}

const WORK_ACTION: Record<string, string> = {
  builder: 'build',
  woodcutter: 'chopwood',
  forager: 'forageberry',
  farmer: 'farm',
  stoneminer: 'minestone',
  goldminer: 'minegold',
  hunter: 'takemeat',
}

export function getWorkCycleMs(
  config: UnitConfig,
  work: string,
  sheet?: WorkSpriteSheet,
  actionOverride?: string
): number {
  const action = actionOverride ?? WORK_ACTION[work]
  const sequence = getConfiguredActionFrameSequence({ work, action: action ?? null })
  const frameCount = sequence?.length ?? Object.values(sheet?.animations ?? {})[0]?.length ?? 6
  const animationMs = getAnimationCycleMs(frameCount, getUnitSpritesheetAnimationSpeed(sheet))
  const cost = getBaseActionEnergyCost(config.energyCosts as Record<string, number> | undefined, action)
  const regen = Math.max(0.1, config.energyRegenRate ?? DEFAULT_UNIT_ENERGY_REGEN_PER_SECOND)
  const recoveryMs =
    (cost / regen) * 1000 + Math.max(0, Number(config.energyRegenDelay ?? DEFAULT_UNIT_ENERGY_REGEN_DELAY_MS))
  return Math.max(animationMs, recoveryMs)
}
