import { Graphics } from 'pixi.js'
import { COLOR_FLASHY_GREEN, LABEL_TYPES } from '../../constants'

export function drawInstanceBlinkingSelection(instance) {
  const selection = new Graphics()
  selection.label = LABEL_TYPES.selection
  selection.zIndex = 3

  const path = [-32 * instance.size, 0, 0, -16 * instance.size, 32 * instance.size, 0, 0, 16 * instance.size]
  selection.poly(path)
  selection.stroke(COLOR_FLASHY_GREEN)
  instance.addChildAt(selection, 0)

  const blink = (alpha, duration) =>
    new Promise(resolve => {
      selection.alpha = alpha
      setTimeout(resolve, duration)
    })

  const blinkSequence = async () => {
    await blink(1, 500)
    await blink(0, 300)
    await blink(1, 300)
    await blink(0, 300)
    await blink(1, 300)
    instance.removeChild(selection)
  }

  blinkSequence()
}
