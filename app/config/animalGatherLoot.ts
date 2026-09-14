type MeatGatherBonusResource = 'feather' | 'leather' | 'sinew'
type MeatGatherBonusDrop = { chance: number; resource: MeatGatherBonusResource }

export const MEAT_GATHER_BONUS_DROPS: Record<string, MeatGatherBonusDrop[]> = {
  BlackGrouse: [{ chance: 0.2, resource: 'feather' }],
  Boar: [
    { chance: 0.08, resource: 'leather' },
    { chance: 0.06, resource: 'sinew' },
  ],
  Deer: [
    { chance: 0.08, resource: 'leather' },
    { chance: 0.05, resource: 'sinew' },
  ],
  Fox: [
    { chance: 0.06, resource: 'leather' },
    { chance: 0.04, resource: 'sinew' },
  ],
  Hare: [
    { chance: 0.03, resource: 'leather' },
    { chance: 0.02, resource: 'sinew' },
  ],
  Horse: [
    { chance: 0.08, resource: 'leather' },
    { chance: 0.05, resource: 'sinew' },
  ],
  Wolf: [
    { chance: 0.06, resource: 'leather' },
    { chance: 0.07, resource: 'sinew' },
  ],
}
