import { ctx, state } from './state'

const sheets = new Map<string, { image: HTMLImageElement; frames: Record<string, any> }>()

export async function loadSheet(name: string, data, src: string) {
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(`Sprite introuvable : ${name}`))
    image.src = src
  })
  sheets.set(name, { image, frames: data.frames })
}

export function frame(sheet: string, index: number) {
  const atlas = sheets.get(sheet)
  if (!atlas) throw new Error(`Atlas absent : ${sheet}`)
  const keys = Object.keys(atlas.frames).sort((a, b) => parseInt(a) - parseInt(b))
  const key = keys.find(key => parseInt(key) === index) ?? keys[index]
  if (!key) throw new Error(`Image absente : ${sheet}, ${index}`)
  return { image: atlas.image, ...atlas.frames[key] }
}

export function sprite(
  sheet: string,
  index: number,
  x: number,
  y: number,
  options: { width?: number; height?: number; flip?: boolean; tint?: number; center?: boolean } = {}
) {
  const asset = frame(sheet, index),
    f = asset.frame
  const w = options.width ?? f.w,
    h = options.height ?? f.h
  const anchor = options.center
    ? { x: Math.floor(w / 2) / w, y: Math.floor(h / 2) / h }
    : options.width
      ? { x: 0, y: 0 }
      : (asset.anchor ?? { x: 0.5, y: 0.5 })
  ctx.save()
  ctx.translate(x + state.offsetX, y + state.offsetY)
  if (options.flip) {
    if (options.width) ctx.translate(w, 0)
    ctx.scale(-1, 1)
  }
  if (options.tint && options.tint !== 0xffffff) ctx.filter = `brightness(${(options.tint & 255) / 255})`
  ctx.drawImage(asset.image, f.x, f.y, f.w, f.h, -anchor.x * w, -anchor.y * h, w, h)
  ctx.restore()
}
