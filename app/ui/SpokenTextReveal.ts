import { getVolume } from '../lib/audio/settings'

type TextBlock = { element: HTMLElement; text: string }
type Voice = 'male' | 'female'
const WORD_DELAY_MS = 72
const VOICE_SOUNDS: Record<Voice, string> = {
  male: 'assets/sounds/source/ogg/bleep017.ogg',
  female: 'assets/sounds/source/ogg/bleep009.ogg',
}

/** Shared dialogue/narration reveal. Owns and cancels both its timer and voice. */
export class SpokenTextReveal {
  private timer: number | null = null
  private generation = 0
  private blocks: TextBlock[] = []
  private readonly voices = { male: new Audio(VOICE_SOUNDS.male), female: new Audio(VOICE_SOUNDS.female) }

  show(blocks: TextBlock[], voice: Voice = 'male', onComplete?: () => void): void {
    this.stop()
    this.blocks = blocks
    const generation = this.generation
    const words = blocks.flatMap(block => {
      block.element.textContent = ''
      block.element.classList.add('is-typing')
      return block.text.split(/\s+/).filter(Boolean).map(word => ({ block, word }))
    })
    if (words.length <= 1) {
      for (const block of blocks) block.element.textContent = block.text
      this.finish()
      onComplete?.()
      return
    }
    let index = 0
    const next = () => {
      if (generation !== this.generation) return
      this.timer = null
      if (index === words.length) { this.finish(); onComplete?.(); return }
      const { block, word } = words[index++]
      block.element.textContent = block.element.textContent ? `${block.element.textContent} ${word}` : word
      const audio = this.voices[voice]
      audio.currentTime = 0
      audio.volume = getVolume()
      audio.play().catch(() => {})
      this.timer = window.setTimeout(next, WORD_DELAY_MS)
    }
    next()
  }

  /** Returns true when an in-progress line was completed by the reader. */
  revealAll(): boolean {
    if (this.timer === null) return false
    const blocks = this.blocks
    this.stop()
    for (const block of blocks) block.element.textContent = block.text
    return true
  }

  private finish(): void {
    for (const block of this.blocks) block.element.classList.remove('is-typing')
  }

  stop(): void {
    this.generation++
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    this.finish()
    this.blocks = []
    for (const audio of Object.values(this.voices)) {
      audio.pause()
      audio.currentTime = 0
    }
  }
}
