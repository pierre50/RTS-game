import { Assets, Spritesheet } from 'pixi.js'
import type { Texture } from 'pixi.js'

/** All building levels share frame geometry, anchors and the shadow atlas. */
export async function registerBuildingSpritesheets(): Promise<void> {
  const base = Assets.cache.get<Spritesheet>('buildings/age-0')
  const shadow = Assets.cache.get<Spritesheet>('buildings/age-0/shadow')

  for (const level of [1, 2]) {
    const alias = `buildings/age-${level}`
    if (Assets.cache.has(alias)) continue
    const texture = Assets.cache.get<Texture>(`${alias}/image`)
    const sheet = new Spritesheet({
      texture,
      data: base.data,
      cachePrefix: `${alias}/`,
    })
    await sheet.parse()
    Assets.cache.set(alias, sheet)
    Assets.cache.set(`${alias}/shadow`, shadow)
  }
}
