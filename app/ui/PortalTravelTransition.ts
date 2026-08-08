import { t } from '../lib/lang'

const FINISH_MS = 520
const FIRST_FLASH_MS = 120

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

  constructor(color: 'blue' | 'yellow' | 'red') {
    this.root = document.createElement('div')
    this.root.className = `portal-travel portal-travel--${color}`
    this.root.setAttribute('role', 'status')
    this.root.setAttribute('aria-live', 'polite')

    const core = document.createElement('div')
    core.className = 'portal-travel__core'
    core.setAttribute('aria-hidden', 'true')

    for (let i = 0; i < 3; i++) {
      const ring = document.createElement('span')
      ring.className = `portal-travel__ring portal-travel__ring--${i + 1}`
      core.appendChild(ring)
    }

    for (let i = 0; i < 10; i++) {
      const shard = document.createElement('span')
      shard.className = 'portal-travel__shard'
      shard.style.setProperty('--portal-shard-index', String(i))
      core.appendChild(shard)
    }

    this.status = document.createElement('div')
    this.status.className = 'portal-travel__status'
    this.status.textContent = t('generatingWorld')

    this.progress = document.createElement('div')
    this.progress.className = 'portal-travel__progress'

    this.root.append(core, this.status, this.progress)
    document.body.appendChild(this.root)
    this.root.classList.add('is-open')
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
