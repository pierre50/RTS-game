import { t } from '../lib/lang'

const DEPARTURE_FADE_MS = 220
const ARRIVAL_FADE_MS = 320

function wait(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

function waitForFrame(): Promise<void> {
  if (document.hidden || typeof window.requestAnimationFrame !== 'function') return wait(0)
  return new Promise(resolve => {
    // A hidden or suspended renderer may stop delivering animation frames.
    const timeout = window.setTimeout(resolve, 100)
    window.requestAnimationFrame(() => {
      window.clearTimeout(timeout)
      resolve()
    })
  })
}

async function waitForTransitionFrames(count = 2): Promise<void> {
  for (let index = 0; index < count; index += 1) await waitForFrame()
}

export class BuildingInteriorTransition {
  root: HTMLDivElement | null
  status: HTMLDivElement
  progress: HTMLDivElement

  constructor(options: { mode?: 'loading' | 'door' } = {}) {
    this.root = document.createElement('div')
    this.root.className = 'building-interior-transition'
    if (options.mode === 'door') this.root.classList.add('building-interior-transition--door')
    this.root.setAttribute('role', 'status')
    this.root.setAttribute('aria-live', 'polite')

    this.status = document.createElement('div')
    this.status.className = 'building-interior-transition__status'
    this.status.textContent = t('generatingWorld')

    this.progress = document.createElement('div')
    this.progress.className = 'building-interior-transition__progress'

    if (options.mode !== 'door') this.root.append(this.status, this.progress)
    document.body.appendChild(this.root)
  }

  update(messageKey: string, progress: number): void {
    const percent = Math.max(0, Math.min(100, Math.round((Number.isFinite(progress) ? progress : 0) * 100)))
    this.status.textContent = t(messageKey)
    this.progress.style.setProperty('--building-interior-progress', `${percent}%`)
  }

  async playDeparture(): Promise<void> {
    if (!this.root) return
    await waitForTransitionFrames()
    await this.fade('is-open', DEPARTURE_FADE_MS)
  }

  async finish(): Promise<void> {
    if (!this.root) return
    await this.fade('is-arriving', ARRIVAL_FADE_MS)
    this.destroy()
  }

  private async fade(className: string, duration: number): Promise<void> {
    const root = this.root
    if (!root) return
    await new Promise<void>(resolve => {
      const finish = (): void => {
        window.clearTimeout(timeout)
        root.removeEventListener('transitionend', onEnd)
        resolve()
      }
      const onEnd = (event: TransitionEvent): void => {
        if (event.target === root && event.propertyName === 'opacity') finish()
      }
      // Transition events can be skipped when the document is hidden.
      const timeout = window.setTimeout(finish, document.hidden ? 0 : duration + 100)
      root.addEventListener('transitionend', onEnd)
      root.classList.add(className)
    })
  }

  destroy(): void {
    this.root?.remove()
    this.root = null
  }
}

export async function playBuildingInteriorDoorTransition(
  callback: () => void | Promise<void>,
  options: { blockInput?: boolean; beforeReveal?: () => void | Promise<void> } = {}
): Promise<void> {
  const transition = new BuildingInteriorTransition({ mode: 'door' })
  try {
    if (options.blockInput && transition.root) {
      transition.root.style.zIndex = '20000'
      transition.root.style.pointerEvents = 'auto'
    }
    await transition.playDeparture()
    await waitForTransitionFrames()
    await callback()
    await options.beforeReveal?.()
    await waitForTransitionFrames()
    await transition.finish()
  } finally {
    transition.destroy()
  }
}
