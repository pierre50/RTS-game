export function canvasDrawRectangle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string
): void {
  context.fillStyle = color
  context.fillRect(x, y, width, height)
}

export function canvasDrawStrokeRectangle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string
): void {
  context.strokeStyle = color
  context.strokeRect(x, y, width, height)
}

export function canvasDrawDiamond(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string
): void {
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
