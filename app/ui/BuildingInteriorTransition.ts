import { t } from '../lib/lang'

const DEPARTURE_FADE_MS = 220
const ARRIVAL_FADE_MS = 320

function wait(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

function waitForFrame(): Promise<void> {
  return new Promise(resolve => window.requestAnimationFrame(() => resolve()))
}

export class BuildingInteriorTransition {
  root: HTMLDivElement | null
  status: HTMLDivElement
  progress: HTMLDivElement

  constructor() {
    this.root = document.createElement('div')
    this.root.className = 'building-interior-transition'
    this.root.setAttribute('role', 'status')
    this.root.setAttribute('aria-live', 'polite')

    this.status = document.createElement('div')
    this.status.className = 'building-interior-transition__status'
    this.status.textContent = t('generatingWorld')

    this.progress = document.createElement('div')
    this.progress.className = 'building-interior-transition__progress'

    this.root.append(this.status, this.progress)
    document.body.appendChild(this.root)
  }

  update(messageKey: string, progress: number): void {
    const percent = Math.max(0, Math.min(100, Math.round((Number.isFinite(progress) ? progress : 0) * 100)))
    this.status.textContent = t(messageKey)
    this.progress.style.setProperty('--building-interior-progress', `${percent}%`)
  }

  async playDeparture(): Promise<void> {
    if (!this.root) return
    await waitForFrame()
    this.root.classList.add('is-open')
    await wait(DEPARTURE_FADE_MS)
  }

  async finish(): Promise<void> {
    if (!this.root) return
    this.root.classList.add('is-arriving')
    await wait(ARRIVAL_FADE_MS)
    this.destroy()
  }

  destroy(): void {
    this.root?.remove()
    this.root = null
  }
}
