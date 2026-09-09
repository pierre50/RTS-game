import type { RuntimeEntity } from '../../types/entities'
import type { PolygonPoint } from '../geometry/polygon'

export type ContactActionProfile = {
  reach: number
  handOffset: number
  width: number
  halfAngle: number
}
export type ContactBodyProfile = { radius: number; verticalScale: number }
export type ContactProfileOverride = {
  action?: Partial<ContactActionProfile>
  body?: Partial<ContactBodyProfile>
}
export type ContactActor = RuntimeEntity & { degree?: number; spriteScale?: number }
export type ContactShape = readonly PolygonPoint[]
export type ContactOptions = { allowDeadTarget?: boolean; degree?: number }
export type ContactApproachSample = {
  point: PolygonPoint
  degree: number
  distance: number
  reachable: boolean
}
