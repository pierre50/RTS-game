import { FAMILY_TYPES } from '../constants'
import {
  CONTACT_ACTION_PROFILES,
  CONTACT_BODY_PROFILES,
  CONTACT_ENTITY_OVERRIDES,
  CONTACT_TOOL_PROFILES,
  CONTACT_TOOL_OVERRIDES,
} from '../../config/contactProfiles'
import type { RuntimeEntity } from '../../types/entities'
import type { ContactActionProfile, ContactActor, ContactBodyProfile } from './contactTypes'

function positive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

export function getContactScale(entity: RuntimeEntity & { spriteScale?: number }): number {
  return positive(entity.spriteScale, 1)
}

export function resolveContactActionProfile(actor: ContactActor, tool?: string): ContactActionProfile {
  const base = tool
    ? CONTACT_ACTION_PROFILES[CONTACT_TOOL_PROFILES[tool] ?? 'unarmed']
    : CONTACT_ACTION_PROFILES[actor.family === FAMILY_TYPES.animal ? 'animal' : 'unarmed']
  const override = tool
    ? { ...CONTACT_TOOL_OVERRIDES[tool], ...actor.owner?.config?.equipment?.[tool]?.contact }
    : { ...CONTACT_ENTITY_OVERRIDES[actor.type]?.action, ...actor.contact?.action }
  const reach = positive(override.reach, base.reach)
  return {
    reach,
    width: positive(override.width, base.width),
    handOffset: Math.min(
      reach,
      typeof override.handOffset === 'number' && Number.isFinite(override.handOffset) && override.handOffset >= 0
        ? override.handOffset
        : base.handOffset
    ),
    halfAngle: Math.min(89, positive(override.halfAngle, base.halfAngle)),
  }
}

export function resolveContactBodyProfile(entity: RuntimeEntity): ContactBodyProfile {
  const base = CONTACT_BODY_PROFILES[entity.family === FAMILY_TYPES.animal ? 'animal' : 'unit']
  const override = { ...CONTACT_ENTITY_OVERRIDES[entity.type]?.body, ...entity.contact?.body }
  return {
    radius: positive(override.radius, base.radius),
    verticalScale: positive(override.verticalScale, base.verticalScale),
  }
}
