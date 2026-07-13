export type LpcCivilizationVisualProfile = {
  skinPalettes: string[]
  hairPalettes: string[]
  hairstyles: string[]
  beardStyles: string[]
}

export const DEFAULT_LPC_CIVILIZATION_PROFILE: LpcCivilizationVisualProfile = {
  skinPalettes: ['olive'],
  hairPalettes: ['dark_brown'],
  hairstyles: ['messy3', 'plain', 'parted'],
  beardStyles: ['beard/basic', 'beard/trimmed', 'mustache/basic'],
}

export const LPC_CIVILIZATION_PROFILES: Record<string, LpcCivilizationVisualProfile> = {
  Greek: {
    skinPalettes: ['olive'],
    hairPalettes: ['dark_brown'],
    hairstyles: ['messy3', 'curtains', 'parted', 'long'],
    beardStyles: ['beard/basic', 'beard/trimmed', 'mustache/basic', 'mustache/chevron'],
  },
  Egyptian: {
    skinPalettes: ['brown'],
    hairPalettes: ['black'],
    hairstyles: ['plain', 'bangs', 'balding', 'messy3'],
    beardStyles: ['beard/trimmed', 'beard/5oclock_shadow', 'mustache/basic', 'mustache/chevron'],
  },
  Babylonian: {
    skinPalettes: ['fair'],
    hairPalettes: ['black'],
    hairstyles: ['parted', 'long', 'curtains', 'messy3'],
    beardStyles: ['beard/basic', 'beard/medium', 'beard/trimmed', 'mustache/bigstache'],
  },
  Asian: {
    skinPalettes: ['golden'],
    hairPalettes: ['black'],
    hairstyles: ['plain', 'long', 'bangs', 'parted'],
    beardStyles: ['beard/5oclock_shadow', 'beard/trimmed', 'mustache/basic'],
  },
}

export function getLpcCivilizationProfile(civilization: string | null | undefined): LpcCivilizationVisualProfile {
  return civilization ? (LPC_CIVILIZATION_PROFILES[civilization] ?? DEFAULT_LPC_CIVILIZATION_PROFILE) : DEFAULT_LPC_CIVILIZATION_PROFILE
}

export function pickLpcProfileValue(values: string[], seed: number): string {
  return values[Math.abs(seed) % values.length]
}
