export function canvasDrawRectangle(context, x, y, width, height, color) {
  context.fillStyle = color
  context.fillRect(x, y, width, height)
}

export function canvasDrawStrokeRectangle(context, x, y, width, height, color) {
  context.strokeStyle = color
  context.strokeRect(x, y, width, height)
}

export function canvasDrawDiamond(context, x, y, width, height, color) {
  context.save()
  context.beginPath()
  context.moveTo(x, y)
  context.lineTo(x - width / 2, y + height / 2)
  context.lineTo(x, y + height)
  context.lineTo(x + width / 2, y + height / 2)
  context.closePath()

  context.fillStyle = color
  context.fill()
  context.restore()
}
