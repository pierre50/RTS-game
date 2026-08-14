import { t } from '../lib/lang'

const FINISH_MS = 520
const FIRST_FLASH_MS = 120
const HERO_FRAME_SIZE = 64
const HERO_DIRECTION_COUNT = 3
const HERO_SOUTH_DIRECTION_INDEX = 2

type PortalTravelTransitionOptions = {
  heroImageSrc?: string | null
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

function waitForFrame(): Promise<void> {
  return new Promise(resolve => window.requestAnimationFrame(() => resolve()))
}

export class PortalTravelTransition {
  root: HTMLDivElement | null
  status: HTMLDivElement
  progress: HTMLDivElement

  constructor(color: 'blue' | 'yellow' | 'red', options: PortalTravelTransitionOptions = {}) {
    this.root = document.createElement('div')
    this.root.className = `portal-travel portal-travel--${color}`
    this.root.setAttribute('role', 'status')
    this.root.setAttribute('aria-live', 'polite')

    const core = document.createElement('div')
    core.className = 'portal-travel__core'
    core.setAttribute('aria-hidden', 'true')

    const hero = this._createHeroSprite(options.heroImageSrc)
    this.status = document.createElement('div')
    this.status.className = 'portal-travel__status'
    this.status.textContent = t('generatingWorld')

    this.progress = document.createElement('div')
    this.progress.className = 'portal-travel__progress'

    this.root.append(hero, core, this.status, this.progress)
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
        const totalFrames = Math.max(1, Math.floor(img.naturalWidth / HERO_FRAME_SIZE))
        const framesPerDirection = Math.max(1, Math.floor(totalFrames / HERO_DIRECTION_COUNT))
        const southFrameIndex = framesPerDirection * HERO_SOUTH_DIRECTION_INDEX
        img.style.transform = `translateX(-${southFrameIndex * HERO_FRAME_SIZE}px)`
        frame.style.setProperty('--portal-hero-frame-x', `-${southFrameIndex * HERO_FRAME_SIZE}px`)
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

  async finish(): Promise<void> {
    if (!this.root) return
    this.root.classList.add('is-arriving')
    await wait(FINISH_MS)
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
