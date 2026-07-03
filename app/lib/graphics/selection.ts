import { Graphics } from 'pixi.js'
import { COLOR_GREEN, LABEL_TYPES } from '../../constants'

type SelectableInstance = {
  addChildAt: (child: Graphics, index: number) => void
  removeChild: (child: Graphics) => void
  selectionFactor?: number
  size: number
}

export function drawInstanceBlinkingSelection(instance: SelectableInstance): void {
  const selection = new Graphics()
  selection.label = LABEL_TYPES.selection
  selection.zIndex = 3

  const selectionFactor = instance.selectionFactor ?? instance.size
  const path = [-32 * selectionFactor, 0, 0, -16 * selectionFactor, 32 * selectionFactor, 0, 0, 16 * selectionFactor]
  selection.poly(path)
  selection.stroke(COLOR_GREEN)
  instance.addChildAt(selection, 0)

  const blink = (alpha: number, duration: number): Promise<void> =>
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
