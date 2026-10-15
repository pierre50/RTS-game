type Listener = (...args: unknown[]) => void

/** Events on logical resources stay alive when their visual container is discarded. */
export class ResourceEvents {
  private listeners = new Map<string, Set<{ callback: Listener; original: Listener }>>()

  on(event: string, callback: Listener): void {
    let listeners = this.listeners.get(event)
    if (!listeners) this.listeners.set(event, (listeners = new Set()))
    listeners.add({ callback, original: callback })
  }

  once(event: string, callback: Listener): void {
    const wrapper: Listener = (...args) => {
      this.off(event, callback)
      callback(...args)
    }
    let listeners = this.listeners.get(event)
    if (!listeners) this.listeners.set(event, (listeners = new Set()))
    listeners.add({ callback: wrapper, original: callback })
  }

  off(event: string, callback: Listener): void {
    const listeners = this.listeners.get(event)
    if (!listeners) return
    for (const listener of listeners) if (listener.original === callback) listeners.delete(listener)
    if (!listeners.size) this.listeners.delete(event)
  }

  emit(event: string, ...args: unknown[]): boolean {
    const listeners = this.listeners.get(event)
    if (!listeners?.size) return false
    for (const listener of [...listeners]) listener.callback(...args)
    return true
  }
}
