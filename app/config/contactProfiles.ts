import type { ContactActionProfile, ContactBodyProfile, ContactProfileOverride } from '../lib/contact/contactTypes'

// Ground-plane sprite pixels before spriteScale. Tune here with debug.contact enabled.
export const CONTACT_ACTION_PROFILES = {
  sword: { reach: 38, handOffset: 10, width: 6, halfAngle: 45 },
  axe: { reach: 32, handOffset: 10, width: 10, halfAngle: 45 },
  spear: { reach: 52, handOffset: 10, width: 5, halfAngle: 16 },
  animal: { reach: 26, handOffset: 10, width: 12, halfAngle: 40 },
  pickaxe: { reach: 30, handOffset: 10, width: 8, halfAngle: 35 },
  scythe: { reach: 34, handOffset: 10, width: 8, halfAngle: 45 },
  unarmed: { reach: 18, handOffset: 8, width: 6, halfAngle: 30 },
} satisfies Record<string, ContactActionProfile>

export const CONTACT_BODY_PROFILES = {
  unit: { radius: 12, verticalScale: 0.5 },
  animal: { radius: 16, verticalScale: 0.5 },
} satisfies Record<string, ContactBodyProfile>

type ActionProfileName = keyof typeof CONTACT_ACTION_PROFILES
const TOOL_FAMILIES: Record<string, ActionProfileName> = {
  sword: 'sword',
  longsword: 'sword',
  cane: 'sword',
  axe: 'axe',
  hammer: 'axe',
  mace: 'axe',
  spear: 'spear',
  pike: 'spear',
  lance: 'spear',
  halberd: 'spear',
  pickaxe: 'pickaxe',
  scythe: 'scythe',
}
const MATERIALS = ['ceramic', 'copper', 'bronze', 'iron']
export const CONTACT_TOOL_PROFILES: Readonly<Record<string, ActionProfileName>> = Object.fromEntries(
  Object.entries(TOOL_FAMILIES).flatMap(([tool, profile]) =>
    [tool, ...MATERIALS.map(material => `${tool}_${material}`)].map(key => [key, profile])
  )
)

// Optional exact-key exceptions. Per-entity gameplay config can also set `contact`;
// equipment config can set `contact` to override that item's action profile.
export const CONTACT_ENTITY_OVERRIDES: Readonly<Record<string, ContactProfileOverride>> = {}
export const CONTACT_TOOL_OVERRIDES: Readonly<Record<string, Partial<ContactActionProfile>>> = {}
export const CONTACT_APPROACH = { activationDistance: 80, maxStep: 2, maxSteps: 120 } as const

export const GATHER_CONTACT_STALL = { maxTicks: 30, probeEvery: 5, minimumProgress: 1 } as const
