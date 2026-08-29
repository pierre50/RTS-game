import { sound, type IMediaInstance } from '@pixi/sound'

export type WeatherLoopInstance = IMediaInstance

export function startAmbientLoop(alias: string, onReady: (instance: WeatherLoopInstance) => void): void {
  const result = sound.play(alias, { loop: true, volume: 0 })
  if (result instanceof Promise) result.then(onReady).catch(() => {})
  else onReady(result)
}
