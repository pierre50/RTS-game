import { Container, Text } from 'pixi.js'

type StatusBubbleOptions = {
  text: string
  fontSize?: number
}

const STATUS_EXPRESSION_FONT_FAMILY = 'm6x11, system-ui, sans-serif'
const STATUS_EXPRESSION_SCALE = 1.6
const STATUS_EXPRESSION_MIN_FONT_SIZE = 18
const STATUS_EXPRESSION_COLORS: Record<string, number> = {
  '!': 0xffd747,
  '!!': 0xff9f1c,
  '...': 0xc7f0ff,
  zzz: 0x69b7ff,
  '?': 0xc891ff,
  X: 0xff5f57,
  '♥': 0xff6fae,
}
const STATUS_EXPRESSION_STROKE = 0x20140b

function getStatusExpressionColor(text: string): number {
  return STATUS_EXPRESSION_COLORS[text.toLowerCase()] ?? 0xffffff
}

export function createStatusBubble(options: StatusBubbleOptions): Container {
  const fontSize = Math.max(
    STATUS_EXPRESSION_MIN_FONT_SIZE,
    Math.round((options.fontSize ?? 13) * STATUS_EXPRESSION_SCALE)
  )
  const text = new Text({
    text: options.text,
    style: {
      fill: getStatusExpressionColor(options.text),
      fontFamily: STATUS_EXPRESSION_FONT_FAMILY,
      fontSize,
      fontWeight: '900',
      stroke: { color: STATUS_EXPRESSION_STROKE, width: 3 },
    },
  })
  text.anchor.set(0.5, 0.5)
  text.y = -fontSize * 0.5

  const expression = new Container()
  expression.addChild(text)
  return expression
}
