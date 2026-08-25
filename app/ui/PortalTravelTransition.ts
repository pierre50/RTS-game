import { t } from '../lib/lang'

const FALLBACK_FINISH_MS = 520
const FIRST_FLASH_MS = 120
const DEPARTURE_REVEAL_MS = 460
const ARRIVAL_REVEAL_MS = 780
const REVEAL_RADIUS_PADDING = 48
const HERO_FRAME_SIZE = 64
const HERO_ATLAS_FRAME_STRIDE = HERO_FRAME_SIZE + 1
const HERO_BODY_WALKING_SOUTH_FRAME_X = 18 * HERO_ATLAS_FRAME_STRIDE

export type PortalRevealPoint = {
  x: number
  y: number
}

type PortalTravelTransitionOptions = {
  heroImageSrc?: string | null
}

type PortalRevealOptions = {
  revealFrom?: PortalRevealPoint | null
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

function waitForFrame(): Promise<void> {
  return new Promise(resolve => window.requestAnimationFrame(() => resolve()))
}

function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2
}

function maxRevealRadius(point: PortalRevealPoint): number {
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

export class PortalTravelTransition {
  root: HTMLDivElement | null
  revealMask: HTMLDivElement
  status: HTMLDivElement
  progress: HTMLDivElement

  constructor(color: 'blue' | 'yellow' | 'red', options: PortalTravelTransitionOptions = {}) {
    this.root = document.createElement('div')
    this.root.className = `portal-travel portal-travel--${color}`
    this.root.setAttribute('role', 'status')
    this.root.setAttribute('aria-live', 'polite')

    this.revealMask = document.createElement('div')
    this.revealMask.className = 'portal-travel__reveal-mask'
    this.revealMask.setAttribute('aria-hidden', 'true')

    const core = document.createElement('div')
    core.className = 'portal-travel__core'
    core.setAttribute('aria-hidden', 'true')

    const hero = this._createHeroSprite(options.heroImageSrc)
    this.status = document.createElement('div')
    this.status.className = 'portal-travel__status'
    this.status.textContent = t('generatingWorld')

    this.progress = document.createElement('div')
    this.progress.className = 'portal-travel__progress'

    this.root.append(this.revealMask, hero, core, this.status, this.progress)
    document.body.appendChild(this.root)
    this.root.classList.add('is-open')
  }

  _createHeroSprite(src?: string | null): HTMLDivElement {
    const path = document.createElement('div')
    path.className = 'portal-travel__hero-path'
    path.setAttribute('aria-hidden', 'true')

    const orbit = document.createElement('div')
    orbit.className = 'portal-travel__hero-orbit'

    const pull = document.createElement('div')
    pull.className = 'portal-travel__hero-pull'

    const spin = document.createElement('div')
    spin.className = 'portal-travel__hero-spin'

    const frame = document.createElement('div')
    frame.className = 'portal-travel__hero-frame'

    if (src) {
      frame.style.setProperty('--portal-hero-image', `url(${JSON.stringify(src)})`)
      const img = document.createElement('img')
      img.className = 'portal-travel__hero-image'
      img.alt = ''
      img.onload = () => {
        img.style.transform = `translateX(-${HERO_BODY_WALKING_SOUTH_FRAME_X}px)`
        frame.style.setProperty('--portal-hero-frame-x', `-${HERO_BODY_WALKING_SOUTH_FRAME_X}px`)
      }
      img.src = src
      frame.appendChild(img)
    }

    spin.appendChild(frame)
    pull.appendChild(spin)
    orbit.appendChild(pull)
    path.appendChild(orbit)
    return path
  }

  update(messageKey: string, progress: number): void {
    const percent = Math.max(0, Math.min(100, Math.round((Number.isFinite(progress) ? progress : 0) * 100)))
    this.status.textContent = t(messageKey)
    this.progress.style.setProperty('--portal-travel-progress', `${percent}%`)
  }

  _setRevealMask(point: PortalRevealPoint, radius: number): void {
    this.revealMask.style.setProperty('--portal-reveal-x', `${point.x}px`)
    this.revealMask.style.setProperty('--portal-reveal-y', `${point.y}px`)
    this.revealMask.style.setProperty('--portal-reveal-radius', `${Math.max(0, radius)}px`)
  }

  async _animateReveal(
    className: string,
    point: PortalRevealPoint,
    fromRadius: number,
    toRadius: number,
    durationMs: number
  ): Promise<void> {
    if (!this.root) return
    this.root.classList.add('is-open', 'is-reveal-active', className)
    this._setRevealMask(point, fromRadius)
    await waitForFrame()

    await new Promise<void>(resolve => {
      const startedAt = performance.now()
      const step = (now: number) => {
        if (!this.root) {
          resolve()
          return
        }
        const progress = Math.min(1, Math.max(0, (now - startedAt) / durationMs))
        const eased = easeInOutCubic(progress)
        this._setRevealMask(point, fromRadius + (toRadius - fromRadius) * eased)
        if (progress < 1) {
          window.requestAnimationFrame(step)
        } else {
          resolve()
        }
      }
      window.requestAnimationFrame(step)
    })
  }

  async playDeparture(point: PortalRevealPoint | null | undefined): Promise<void> {
    if (!this.root || !point) {
      await this.waitForFlash()
      return
    }
    const radius = maxRevealRadius(point)
    await this._animateReveal('is-departing', point, radius, 0, DEPARTURE_REVEAL_MS)
    this.root?.classList.remove('is-reveal-active', 'is-departing')
  }

  async finish(options: PortalRevealOptions = {}): Promise<void> {
    if (!this.root) return
    if (options.revealFrom) {
      await this._animateReveal('is-arriving-reveal', options.revealFrom, 0, maxRevealRadius(options.revealFrom), ARRIVAL_REVEAL_MS)
      this.destroy()
      return
    }
    this.root.classList.add('is-arriving')
    await wait(FALLBACK_FINISH_MS)
    this.destroy()
  }

  async waitForFlash(): Promise<void> {
    if (!this.root) return
    this.root.classList.add('is-open')
    this.root.getBoundingClientRect()
    await waitForFrame()
    await waitForFrame()
    await wait(FIRST_FLASH_MS)
  }

  destroy(): void {
    this.root?.remove()
    this.root = null
  }
}

export class WorldRevealTransition {
  root: HTMLDivElement | null

  constructor(point: PortalRevealPoint | null | undefined) {
    this.root = document.createElement('div')
    this.root.className = 'world-reveal'
    this.root.setAttribute('aria-hidden', 'true')
    document.body.appendChild(this.root)
    if (point) this._setRevealMask(point, 0)
  }

  _setRevealMask(point: PortalRevealPoint, radius: number): void {
    this.root?.style.setProperty('--portal-reveal-x', `${point.x}px`)
    this.root?.style.setProperty('--portal-reveal-y', `${point.y}px`)
    this.root?.style.setProperty('--portal-reveal-radius', `${Math.max(0, radius)}px`)
  }

  async revealFrom(point: PortalRevealPoint | null | undefined): Promise<void> {
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

  destroy(): void {
    this.root?.remove()
    this.root = null
  }
}
