import type { ResourceAmount } from './common'
export type CaveMineralState = {
  i: number
  j: number
  type: 'Gold' | 'Copper' | 'Iron'
  quantity: number
  totalQuantity: number
}

export type CaveDefinition = {
  id: string
  blueprintId: string
  tier: 'small' | 'medium' | 'large'
  seed: number
  banditContent?: {
    ownerLabel: string
    campIndex: number
    inventory: { resources?: ResourceAmount; equipment?: string[] }
    generated?: boolean
  }
  minerals?: CaveMineralState[]
  neutralVillagersGenerated?: boolean
}
export type PlacedCave = CaveDefinition & { i: number; j: number }
