const ARRIVAL_REVEAL_MS = 780
const DEPARTURE_CONCEAL_MS = 360
const REVEAL_RADIUS_PADDING = 48

export type WorldRevealPoint = {
  x: number
  y: number
}

function waitForFrame(): Promise<void> {
  return new Promise(resolve => window.requestAnimationFrame(() => resolve()))
}

function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2
}

function maxRevealRadius(point: WorldRevealPoint): number {
  const width = window.innerWidth || document.documentElement.clientWidth || 1
  const height = window.innerHeight || document.documentElement.clientHeight || 1
  return (
    Math.max(
      Math.hypot(point.x, point.y),
      Math.hypot(width - point.x, point.y),
      Math.hypot(point.x, height - point.y),
      Math.hypot(width - point.x, height - point.y)
    ) + REVEAL_RADIUS_PADDING
  )
}

export class WorldRevealTransition {
  root: HTMLDivElement | null

  constructor(point: WorldRevealPoint | null | undefined) {
    this.root = document.createElement('div')
    this.root.className = 'world-reveal'
    this.root.setAttribute('aria-hidden', 'true')
    document.body.appendChild(this.root)
    if (point) this._setRevealMask(point, 0)
  }

  _setRevealMask(point: WorldRevealPoint, radius: number): void {
    this.root?.style.setProperty('--world-reveal-x', `${point.x}px`)
    this.root?.style.setProperty('--world-reveal-y', `${point.y}px`)
    this.root?.style.setProperty('--world-reveal-radius', `${Math.max(0, radius)}px`)
  }

  async revealFrom(point: WorldRevealPoint | null | undefined): Promise<void> {
    if (!this.root || !point) {
      this.destroy()
      return
    }
    const radius = maxRevealRadius(point)
    await waitForFrame()
    await new Promise<void>(resolve => {
      const startedAt = performance.now()
      const step = (now: number) => {
        if (!this.root) {
          resolve()
          return
        }
        const progress = Math.min(1, Math.max(0, (now - startedAt) / ARRIVAL_REVEAL_MS))
        this._setRevealMask(point, radius * easeInOutCubic(progress))
        if (progress < 1) {
          window.requestAnimationFrame(step)
        } else {
          resolve()
        }
      }
      window.requestAnimationFrame(step)
    })
    this.destroy()
  }

  async concealTo(point: WorldRevealPoint | null | undefined): Promise<void> {
    if (!this.root || !point) return
    const radius = maxRevealRadius(point)
    this._setRevealMask(point, radius)
    await waitForFrame()
    await new Promise<void>(resolve => {
      const startedAt = performance.now()
      const step = (now: number) => {
        if (!this.root) {
          resolve()
          return
        }
        const progress = Math.min(1, Math.max(0, (now - startedAt) / DEPARTURE_CONCEAL_MS))
        this._setRevealMask(point, radius * (1 - easeInOutCubic(progress)))
        if (progress < 1) {
          window.requestAnimationFrame(step)
        } else {
          resolve()
        }
      }
      window.requestAnimationFrame(step)
    })
  }

  destroy(): void {
    this.root?.remove()
    this.root = null
  }
}
