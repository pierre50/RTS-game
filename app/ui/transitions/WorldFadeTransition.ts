export class WorldFadeTransition {
  private root: HTMLDivElement | null
  private animation: Animation | null = null

  constructor() {
    this.root = document.createElement('div')
    this.root.className = 'world-fade-transition'
    this.root.setAttribute('aria-hidden', 'true')
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      background: '#000',
      opacity: '0',
      zIndex: '20000',
      pointerEvents: 'auto',
    })
    document.body.appendChild(this.root)
    document.addEventListener('visibilitychange', this.finishAnimation)
  }

  private finishAnimation = (): void => {
    if (document.hidden) this.animation?.finish()
  }

  private async fade(from: number, to: number, duration: number): Promise<void> {
    const root = this.root
    if (!root) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    root.style.opacity = String(to)
    const animation = root.animate([{ opacity: from }, { opacity: to }], {
      duration: reducedMotion || document.hidden ? 0 : duration,
      easing: 'ease-in-out',
    })
    this.animation = animation
    try {
      await animation.finished
    } catch {
      // Destroying the transition cancels an in-progress animation.
    } finally {
      animation.cancel()
      if (this.animation === animation) this.animation = null
    }
  }

  async conceal(): Promise<void> {
    await this.fade(0, 1, 220)
  }

  async reveal(): Promise<void> {
    await this.fade(1, 0, 300)
  }

  destroy(): void {
    this.animation?.cancel()
    this.animation = null
    document.removeEventListener('visibilitychange', this.finishAnimation)
    this.root?.remove()
    this.root = null
  }
}
