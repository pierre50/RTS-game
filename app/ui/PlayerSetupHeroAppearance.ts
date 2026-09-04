import { t } from '../lib/lang'
import { renderUnitHeadCanvasAvatar } from '../lib/avatar'
import { recolorCanvasByPalette } from '../lib/graphics/colors'
import { civilizationAssetSlug } from '../lib/civilizationAlias'
import {
  HERO_HAIR_COLOR_OPTIONS,
  HERO_HAIR_STYLE_OPTIONS,
  normalizeHeroAppearance,
  normalizeHeroAppearanceGender,
  type HeroHairColor,
} from '../lib/lpc/heroAppearance'
import type { PlayerSetupConfigWithAge } from './PlayerSetupPanel'

const HERO_PREVIEW_SIZE = 96
const HERO_FRAME_SIZE = 64
const HERO_ATLAS_FRAME_STRIDE = HERO_FRAME_SIZE + 1
const HERO_BODY_WALKING_SOUTH_FRAME_X = 18 * HERO_ATLAS_FRAME_STRIDE
const HERO_WALKING_SOUTH_FRAME_NAME = '018'
const HERO_HAIR_SOURCE_PALETTE = 'brown_hair'

type HeroAppearanceHost = {
  heroPreviewRequestId: number
  _setHeroHairColor(playerIndex: number, hairColor: string): void
  _setHeroHairStyle(playerIndex: number, hairStyle: string): void
}

function heroPreviewSrc(player: PlayerSetupConfigWithAge): string {
  const civ = civilizationAssetSlug(player.civ)
  const gender = player.gender === 'female' ? 'female' : 'male'
  return `assets/graphics/units/hero/${civ}/${gender}/texture.png`
}

function heroHairPreviewSrc(player: PlayerSetupConfigWithAge): string {
  const gender = normalizeHeroAppearanceGender(player.gender)
  const appearance = normalizeHeroAppearance(player.heroAppearance, player.civ, gender)
  return `assets/graphics/hero/hair/${appearance.hairStyle}/${gender}/texture.png`
}

function heroHairPreviewJsonSrc(player: PlayerSetupConfigWithAge): string {
  const gender = normalizeHeroAppearanceGender(player.gender)
  const appearance = normalizeHeroAppearance(player.heroAppearance, player.civ, gender)
  return `assets/graphics/hero/hair/${appearance.hairStyle}/${gender}/texture.json`
}

function drawHeroPreviewFrame(
  ctx: CanvasRenderingContext2D,
  frame: HTMLCanvasElement,
  canvas: HTMLCanvasElement,
  player: PlayerSetupConfigWithAge
): void {
  renderUnitHeadCanvasAvatar(frame, canvas, player.color)
}

function drawHeroHairPreview(
  host: HeroAppearanceHost,
  frameCtx: CanvasRenderingContext2D,
  player: PlayerSetupConfigWithAge,
  onDone: () => void
): void {
  const img = new Image()
  img.onload = async () => {
    try {
      const response = await fetch(heroHairPreviewJsonSrc(player))
      const sheet = await response.json()
      const entry = Object.entries(sheet.frames ?? {}).find(([name]) =>
        name.startsWith(HERO_WALKING_SOUTH_FRAME_NAME) && name.includes('_front_walking')
      ) as [string, { frame: { x: number; y: number; w: number; h: number } }] | undefined
      const frameData = entry?.[1]?.frame
      if (!frameData) {
        onDone()
        return
      }
      const hair = document.createElement('canvas')
      hair.width = HERO_FRAME_SIZE
      hair.height = HERO_FRAME_SIZE
      const hairCtx = hair.getContext('2d')
      if (!hairCtx) {
        onDone()
        return
      }
      hairCtx.imageSmoothingEnabled = false
      hairCtx.drawImage(img, frameData.x, frameData.y, frameData.w, frameData.h, 0, 0, HERO_FRAME_SIZE, HERO_FRAME_SIZE)
      recolorCanvasByPalette(hair, HERO_HAIR_SOURCE_PALETTE, player.heroAppearance.hairColor)
      frameCtx.drawImage(hair, 0, 0)
    } catch {
      // The preview should still render the base hero if a custom hair atlas is missing.
    }
    onDone()
  }
  img.onerror = onDone
  img.src = heroHairPreviewSrc(player)
  void host
}

function renderHeroPreview(
  host: HeroAppearanceHost,
  canvas: HTMLCanvasElement,
  player: PlayerSetupConfigWithAge
): void {
  const requestId = ++host.heroPreviewRequestId
  const img = new Image()
  let triedFallback = false
  img.onload = () => {
    if (requestId !== host.heroPreviewRequestId) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const frame = document.createElement('canvas')
    frame.width = HERO_FRAME_SIZE
    frame.height = HERO_FRAME_SIZE
    const frameCtx = frame.getContext('2d')
    if (!frameCtx) return
    frameCtx.imageSmoothingEnabled = false

    frameCtx.drawImage(
      img,
      HERO_BODY_WALKING_SOUTH_FRAME_X,
      0,
      HERO_FRAME_SIZE,
      HERO_FRAME_SIZE,
      0,
      0,
      HERO_FRAME_SIZE,
      HERO_FRAME_SIZE
    )
    drawHeroHairPreview(host, frameCtx, player, () => drawHeroPreviewFrame(ctx, frame, canvas, player))
  }
  img.onerror = () => {
    if (requestId !== host.heroPreviewRequestId) return
    if (triedFallback) return
    triedFallback = true
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    img.src = `assets/graphics/units/hero/hellas/male/texture.png`
  }
  img.src = heroPreviewSrc(player)
}

export function createHeroPreview(host: HeroAppearanceHost, player: PlayerSetupConfigWithAge): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'config-row hero-avatar-row'

  const preview = document.createElement('div')
  preview.className = 'hero-avatar-preview'

  const frame = document.createElement('div')
  frame.className = 'hero-avatar-preview-frame'

  const canvas = document.createElement('canvas')
  canvas.width = HERO_PREVIEW_SIZE
  canvas.height = HERO_PREVIEW_SIZE
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', player.name)
  frame.appendChild(canvas)

  preview.appendChild(frame)
  row.appendChild(preview)
  renderHeroPreview(host, canvas, player)
  return row
}

function humanizeAppearanceValue(value: string): string {
  return value
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function createHeroAppearanceControls(host: HeroAppearanceHost, player: PlayerSetupConfigWithAge): HTMLDivElement {
  const group = document.createElement('div')
  group.className = 'hero-appearance-controls'
  const gender = normalizeHeroAppearanceGender(player.gender)
  const appearance = normalizeHeroAppearance(player.heroAppearance, player.civ, gender)
  player.heroAppearance = appearance

  group.appendChild(createHairStyleRow(host, gender, appearance.hairStyle))
  group.appendChild(createHairColorRow(host, appearance.hairColor))
  return group
}

function createHairStyleRow(host: HeroAppearanceHost, gender: 'male' | 'female', currentStyle: string): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'config-row'
  const label = document.createElement('label')
  label.textContent = t('heroHairStyle')
  row.appendChild(label)
  const select = document.createElement('select')
  select.className = 'ui-select'
  HERO_HAIR_STYLE_OPTIONS[gender].forEach(style => {
    const opt = document.createElement('option')
    opt.value = style
    opt.textContent = humanizeAppearanceValue(style)
    if (style === currentStyle) opt.selected = true
    select.appendChild(opt)
  })
  select.onchange = (evt: Event) => host._setHeroHairStyle(0, (evt.target as HTMLSelectElement).value)
  row.appendChild(select)
  return row
}

function createHairColorRow(host: HeroAppearanceHost, currentColor: HeroHairColor): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'config-row'
  const label = document.createElement('label')
  label.textContent = t('heroHairColor')
  row.appendChild(label)
  const select = document.createElement('select')
  select.className = 'ui-select'
  HERO_HAIR_COLOR_OPTIONS.forEach(color => {
    const opt = document.createElement('option')
    opt.value = color
    opt.textContent = humanizeAppearanceValue(color)
    if (color === currentColor) opt.selected = true
    select.appendChild(opt)
  })
  select.onchange = (evt: Event) => host._setHeroHairColor(0, (evt.target as HTMLSelectElement).value)
  row.appendChild(select)
  return row
}
