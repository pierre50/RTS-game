import { Particle, Texture } from 'pixi.js'
import {
  RAIN_TEXTURE_HEIGHT,
  RAIN_TEXTURE_WIDTH,
  SAND_TEXTURE_HEIGHT,
  SAND_TEXTURE_WIDTH,
  SNOW_TEXTURE_HEIGHT,
  SNOW_TEXTURE_WIDTH,
} from './WeatherProfiles'

export class Raindrop extends Particle {
  baseAlpha = 0
  baseLength = 0
  speed = 0
  wobble = 0
}

export class Snowflake extends Particle {
  baseAlpha = 0
  baseScale = 0
  rotationSpeed = 0
  speed = 0
  wobble = 0
}

export class SandGrain extends Particle {
  baseAlpha = 0
  baseScale = 0
  speed = 0
  wobble = 0
}

export function createRainTexture(): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = RAIN_TEXTURE_WIDTH
  canvas.height = RAIN_TEXTURE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable for rain texture')
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(1, 'rgba(255,255,255,0.1)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const texture = Texture.from(canvas)
  texture.source.autoGarbageCollect = false
  return texture
}

export function createSnowTexture(): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = SNOW_TEXTURE_WIDTH
  canvas.height = SNOW_TEXTURE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable for snow texture')
  const centerX = SNOW_TEXTURE_WIDTH / 2
  const centerY = SNOW_TEXTURE_HEIGHT / 2
  ctx.strokeStyle = '#f4fbff'
  ctx.fillStyle = '#ffffff'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(centerX - 2.2, centerY)
  ctx.lineTo(centerX + 2.2, centerY)
  ctx.moveTo(centerX, centerY - 2.2)
  ctx.lineTo(centerX, centerY + 2.2)
  ctx.moveTo(centerX - 1.8, centerY - 1.8)
  ctx.lineTo(centerX + 1.8, centerY + 1.8)
  ctx.moveTo(centerX + 1.8, centerY - 1.8)
  ctx.lineTo(centerX - 1.8, centerY + 1.8)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(centerX, centerY, 1, 0, Math.PI * 2)
  ctx.fill()
  const texture = Texture.from(canvas)
  texture.source.autoGarbageCollect = false
  return texture
}

export function createSandTexture(): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = SAND_TEXTURE_WIDTH
  canvas.height = SAND_TEXTURE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable for sand texture')
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
  gradient.addColorStop(0, 'rgba(235,198,123,0)')
  gradient.addColorStop(0.45, 'rgba(246,218,153,0.82)')
  gradient.addColorStop(1, 'rgba(171,124,55,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const texture = Texture.from(canvas)
  texture.source.autoGarbageCollect = false
  return texture
}
