/** Shared loaders for the Babylon prototypes: blueprint bytes, JSON and TexturePacker sheets as raw pixels. */

export type FrameRect = { x: number; y: number; w: number; h: number }
export type SheetJson = {
  frames: Record<string, { frame: FrameRect; anchor?: { x: number; y: number } }>
  meta?: { image?: string }
}
export type Sheet = { json: SheetJson; image: ImageData }

export function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return (await response.json()) as T
}

export async function loadImagePixels(path: string): Promise<ImageData> {
  const image = new Image()
  image.src = path
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('2D canvas unavailable')
  context.drawImage(image, 0, 0)
  return context.getImageData(0, 0, image.width, image.height)
}

export function createSheetLoader(): (sheet: string) => Promise<Sheet> {
  const sheets = new Map<string, Promise<Sheet>>()
  return sheet => {
    let pending = sheets.get(sheet)
    if (!pending) {
      pending = fetchJson<SheetJson>(`assets/${sheet}/texture.json`).then(async json => ({
        json,
        image: await loadImagePixels(`assets/${sheet}/${json.meta?.image ?? 'texture.png'}`),
      }))
      sheets.set(sheet, pending)
    }
    return pending
  }
}

/** Frame numbers are the zero-padded name prefix, as in lib/graphics/textures.ts. */
export function getFrame(sheet: Sheet, frame: number, sheetName: string): SheetJson['frames'][string] {
  const prefix = `${String(frame).padStart(3, '0')}_`
  const frameName = Object.keys(sheet.json.frames).find(name => name.startsWith(prefix))
  if (!frameName) throw new Error(`Frame ${frame} missing in ${sheetName}`)
  return sheet.json.frames[frameName]
}

export function getFrameRect(sheet: Sheet, frame: number, sheetName: string): FrameRect {
  return getFrame(sheet, frame, sheetName).frame
}
