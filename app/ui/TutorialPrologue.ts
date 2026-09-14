import { SpokenTextReveal } from './SpokenTextReveal'
import { t } from '../lib/lang'

const FADE_MS = 650
const READING_PAUSE_MS = 3000

/** Owns the black screen until the opening scene has been prepared and rendered. */
export class TutorialPrologue {
  readonly root = document.createElement('div')
  private readonly narration = new SpokenTextReveal()
  private readonly text = document.createElement('div')
  private readonly skip = document.createElement('button')
  private decided = false
  private narrationFinished = false
  private advanceTimer: number | undefined
  private finishChoice: ((skip: boolean) => void) | undefined
  private previousFocus = document.activeElement as HTMLElement | null

  constructor() {
    this.root.className = 'tutorial-prologue'
    this.root.setAttribute('role', 'dialog')
    this.root.setAttribute('aria-modal', 'true')
    this.root.setAttribute('aria-label', t('tutorialPrologueLabel'))
    this.text.className = 'tutorial-prologue__text'
    const blocks = ['tutorialPrologueFirst', 'tutorialPrologueSecond', 'tutorialPrologueThird'].map(key => {
      const line = document.createElement('p')
      this.text.appendChild(line)
      return { element: line, text: t(key) }
    })
    this.skip.type = 'button'
    this.skip.className = 'ui-btn tutorial-prologue__skip'
    this.skip.textContent = t('tutorialSkip')
    this.root.append(this.text, this.skip)
    // Prevent game shortcuts and tab focus from reaching the UI behind the prologue.
    this.root.addEventListener('keydown', event => {
      event.stopPropagation()
      if (event.key === 'Tab') {
        event.preventDefault()
        if (!this.decided) {
          this.skip.focus()
        }
      }
    })
    document.body.appendChild(this.root)
    this.skip.focus()
    this.narration.show(blocks, 'male', () => {
      this.narrationFinished = true
      this.scheduleAdvance()
    })
  }

  chooseSkip(): Promise<boolean> {
    return new Promise(resolve => {
      const finish = (skip: boolean) => {
        if (this.decided) return
        this.decided = true
        window.clearTimeout(this.advanceTimer)
        this.narration.stop()
        this.skip.onclick = null
        this.skip.tabIndex = -1
        this.skip.blur()
        this.skip.inert = true
        this.skip.setAttribute('aria-hidden', 'true')
        this.root.classList.add('tutorial-prologue--waiting')
        resolve(skip)
      }
      this.finishChoice = finish
      this.skip.onclick = () => finish(true)
      this.scheduleAdvance()
    })
  }

  private scheduleAdvance(): void {
    if (this.decided || !this.narrationFinished || !this.finishChoice) return
    window.clearTimeout(this.advanceTimer)
    this.advanceTimer = window.setTimeout(() => this.finishChoice?.(false), READING_PAUSE_MS)
  }

  async reveal(): Promise<void> {
    this.root.classList.add('tutorial-prologue--read')
    this.root.classList.add('tutorial-prologue--reveal')
    await new Promise<void>(resolve => window.setTimeout(resolve, FADE_MS))
    this.destroy()
  }

  destroy(): void {
    this.decided = true
    window.clearTimeout(this.advanceTimer)
    this.finishChoice = undefined
    this.narration.stop()
    this.skip.onclick = null
    this.root.remove()
    if (this.previousFocus?.isConnected) this.previousFocus.focus()
    this.previousFocus = null
  }
}
