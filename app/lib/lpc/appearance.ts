import { getLpcCivilizationProfile, pickLpcProfileValue } from './civilizationProfiles'

type LpcVisualIdentity = {
  skinPalette: string
  hairPalette: string
  hairstyle: string
  beardStyle: string
}

export type LpcAppearanceVariants = {
  skin: string
  hair: string
  hairColor: string
  beard: string
}

export function hashLpcAppearanceSeed(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return hash
}

function resolveLpcVisualIdentity(civilization: string | null | undefined, seed: number): LpcVisualIdentity {
  const profile = getLpcCivilizationProfile(civilization)
  return {
    skinPalette: pickLpcProfileValue(profile.skinPalettes, seed),
    hairPalette: pickLpcProfileValue(profile.hairPalettes, seed + 1),
    hairstyle: pickLpcProfileValue(profile.hairstyles, seed + 2),
    beardStyle: pickLpcProfileValue(profile.beardStyles, seed + 3),
  }
}

export function resolveLpcAppearanceVariants(civilization: string | null | undefined, seedValue: string): LpcAppearanceVariants {
  const identity = resolveLpcVisualIdentity(civilization, hashLpcAppearanceSeed(seedValue))
  return {
    skin: identity.skinPalette,
    hair: `${identity.hairstyle}/${identity.hairPalette}`,
    hairColor: identity.hairPalette,
    beard: `${identity.beardStyle}/${identity.hairPalette}`,
  }
}
