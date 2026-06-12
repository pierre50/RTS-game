import { t } from '../lib/lang'

export class GameLoadingScreen {
  constructor() {
    this.root = document.createElement('div')
    this.root.className = 'modal game-loading'
    this.root.setAttribute('role', 'dialog')
    this.root.setAttribute('aria-modal', 'true')
    this.root.setAttribute('aria-labelledby', 'game-loading-title')
    this.root.setAttribute('aria-describedby', 'game-loading-status')

    const panel = document.createElement('div')
    panel.className = 'modal-panel game-loading__panel ui-panel-enter'

    const header = document.createElement('div')
    header.className = 'modal-header game-loading__header'

    const title = document.createElement('div')
    title.id = 'game-loading-title'
    title.className = 'modal-title game-loading__title'
    title.textContent = t('generatingWorld')
    header.appendChild(title)

    this.status = document.createElement('div')
    this.status.id = 'game-loading-status'
    this.status.className = 'game-loading__status'
    this.status.setAttribute('aria-live', 'polite')

    const track = document.createElement('div')
    track.className = 'game-loading__track ui-progress'
    track.setAttribute('role', 'progressbar')
    track.setAttribute('aria-valuemin', '0')
    track.setAttribute('aria-valuemax', '100')
    this.track = track

    this.progress = document.createElement('div')
    this.progress.className = 'game-loading__progress ui-progress__fill'
    track.appendChild(this.progress)

    this.percent = document.createElement('div')
    this.percent.className = 'game-loading__percent'

    panel.append(header, this.status, track, this.percent)
    this.root.appendChild(panel)
    document.body.appendChild(this.root)
  }

  update(messageKey, progress) {
    this.status.textContent = t(messageKey)
    this.setProgress(progress)
  }

  setProgress(progress) {
    const normalizedProgress = Number.isFinite(progress) ? progress : 0
    const percent = Math.max(0, Math.min(100, Math.round(normalizedProgress * 100)))
    this.root.style.setProperty('--game-loading-progress', `${percent}%`)
    this.track.setAttribute('aria-valuenow', String(percent))
    this.percent.textContent = `${percent}%`
  }

  destroy() {
    this.root?.remove()
    this.root = null
  }
}
