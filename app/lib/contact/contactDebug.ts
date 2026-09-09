import type { ContactActor, ContactShape } from './contactTypes'
import { Graphics } from 'pixi.js'
import type { RuntimeEntity } from '../../types/entities'
import { getContactActionShape, getContactTargetShape } from './contactGeometry'

// Enable in the browser console with localStorage.setItem('debug.contact', '1').
// Shapes are ground-plane projections, deliberately independent of camera zoom.
export function showContactDebug(
  actor: ContactActor,
  targets: RuntimeEntity[],
  weapon?: string,
  degree?: number
): void {
  try {
    if (typeof localStorage === 'undefined' || localStorage.getItem('debug.contact') !== '1') return
  } catch {
    return
  }
  const host = actor as ContactActor & { addChild?: (child: Graphics) => unknown; reliefLift?: number }
  if (!host.addChild || !actor.context?.scheduler?.addOneShot) return
  const graphics = new Graphics()
  graphics.eventMode = 'none'
  graphics.zIndex = 1000
  const draw = (points: ContactShape, color: number) => {
    points.forEach((point, index) => {
      const x = point.x - actor.x
      const y = point.y - actor.y + (host.reliefLift ?? 0)
      if (index === 0) graphics.moveTo(x, y)
      else graphics.lineTo(x, y)
    })
    graphics.closePath().fill({ color, alpha: 0.15 }).stroke({ color, width: 1 })
  }
  draw(getContactActionShape(actor, weapon, degree), 0xffcc33)
  for (const target of targets) draw(getContactTargetShape(target), 0x44ddff)
  host.addChild(graphics)
  actor.context.scheduler.addOneShot(
    () => {
      if (graphics.destroyed) return
      graphics.parent?.removeChild(graphics)
      graphics.destroy()
    },
    300,
    'contact.debug'
  )
}
