import type { GridPosition } from './grid'

export type CampBehavior = {
  phase: 'guard' | 'pursue' | 'return'
  homeSpaceId?: string
  caveId?: string
  chaseRange?: number
  tetherRange?: number
}

export type BanditCampPlacement = GridPosition & {
  id?: string
  caveId?: string
  profile?: 'small' | 'lair'
  seed?: number
  unitTypes?: string[]
}
