export type LpcCivilizationVisualProfile = {
  skinPalettes: string[]
  hairPalettes: string[]
  hairstyles: string[]
  beardStyles: string[]
}

const DEFAULT_LPC_CIVILIZATION_PROFILE: LpcCivilizationVisualProfile = {
  skinPalettes: ['olive'],
  hairPalettes: ['dark_brown'],
  hairstyles: ['messy3', 'plain', 'parted'],
  beardStyles: ['beard/basic', 'beard/trimmed', 'mustache/basic'],
}

const LPC_CIVILIZATION_PROFILES: Record<string, LpcCivilizationVisualProfile> = {
  Hellas: {
    skinPalettes: ['olive'],
    hairPalettes: ['dark_brown'],
    hairstyles: ['messy3', 'curtains', 'parted', 'long'],
    beardStyles: ['beard/basic', 'beard/trimmed', 'mustache/basic', 'mustache/chevron'],
  },
  Latium: {
    skinPalettes: ['olive'],
    hairPalettes: ['dark_brown'],
    hairstyles: ['page2', 'parted', 'curtains_long', 'long_messy'],
    beardStyles: ['beard/basic', 'beard/medium', 'beard/trimmed', 'mustache/chevron'],
  },
  Kemet: {
    skinPalettes: ['brown'],
    hairPalettes: ['black'],
    hairstyles: ['plain', 'bangs', 'balding', 'messy3'],
    beardStyles: ['beard/trimmed', 'beard/5oclock_shadow', 'mustache/basic', 'mustache/chevron'],
  },
  Sumeria: {
    skinPalettes: ['fair'],
    hairPalettes: ['black'],
    hairstyles: ['parted', 'long', 'curtains', 'messy3'],
    beardStyles: ['beard/basic', 'beard/medium', 'beard/trimmed', 'mustache/bigstache'],
  },
  Xia: {
    skinPalettes: ['golden'],
    hairPalettes: ['black'],
    hairstyles: ['plain', 'long', 'bangs', 'parted'],
    beardStyles: ['beard/5oclock_shadow', 'beard/trimmed', 'mustache/basic'],
  },
  Alba: {
    skinPalettes: ['fair'],
    hairPalettes: ['brown_hair', 'dark_brown'],
    hairstyles: ['long', 'messy3', 'curtains', 'parted'],
    beardStyles: ['beard/basic', 'beard/medium', 'beard/trimmed', 'mustache/chevron'],
  },
  Nord: {
    skinPalettes: ['nord_fair'],
    hairPalettes: ['blond', 'light_brown'],
    hairstyles: ['long', 'long_messy', 'swoop', 'bangslong'],
    beardStyles: ['beard/basic', 'beard/medium', 'beard/winter/male', 'mustache/chevron'],
  },
  Nobatia: {
    skinPalettes: ['deep_brown'],
    hairPalettes: ['black'],
    hairstyles: ['plain', 'bangs', 'messy3', 'balding'],
    beardStyles: ['beard/trimmed', 'beard/5oclock_shadow', 'mustache/basic', 'mustache/chevron'],
  },
}

export function getLpcCivilizationProfile(civilization: string | null | undefined): LpcCivilizationVisualProfile {
  return civilization ? (LPC_CIVILIZATION_PROFILES[civilization] ?? DEFAULT_LPC_CIVILIZATION_PROFILE) : DEFAULT_LPC_CIVILIZATION_PROFILE
}

export function pickLpcProfileValue(values: string[], seed: number): string {
  return values[Math.abs(seed) % values.length]
}
