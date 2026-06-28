import { Graphics } from 'pixi.js'
import { COLOR_GREEN, LABEL_TYPES } from '../../constants'

export function drawInstanceBlinkingSelection(instance) {
  const selection = new Graphics()
  selection.label = LABEL_TYPES.selection
  selection.zIndex = 3

  const selectionFactor = instance.selectionFactor ?? instance.size
  const path = [
    -32 * selectionFactor,
    0,
    0,
    -16 * selectionFactor,
    32 * selectionFactor,
    0,
    0,
    16 * selectionFactor,
  ]
  selection.poly(path)
  selection.stroke(COLOR_GREEN)
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
