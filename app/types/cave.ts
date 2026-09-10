export type CaveDefinition = {
  id: string
  blueprintId: string
  tier: 'small' | 'medium' | 'large'
  seed: number
}
export type PlacedCave = CaveDefinition & { i: number; j: number }
