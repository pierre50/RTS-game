import { Assets, Container } from 'pixi.js'
import { t } from '../lib/lang'
import { ASSET_BUNDLES, ASSET_LOAD_SEQUENCE } from '../config/assetManifest'
import type { UnitConfig } from '../types/config'

/**
 * Loading Screen
 *
 * @exports LoaderScreen
 */

export default class LoaderScreen extends Container {
  loadingDiv: HTMLDivElement
  done: () => void

  constructor() {
    super()

    this.loadingDiv = document.createElement('div')
    this.loadingDiv.className = 'loading'
    document.body.prepend(this.loadingDiv)
    this.done = () => {}
  }

  async start(): Promise<void> {
    Object.entries(ASSET_BUNDLES).forEach(([bundleName, assets]) => {
      Assets.addBundle(bundleName, assets)
    })

    for (const { bundle, messageKey } of ASSET_LOAD_SEQUENCE) {
      this.loadingDiv.innerHTML = t(messageKey)
      await Assets.loadBundle(bundle)
    }

    const gameConfig: {
      buildings: unknown
      units: Record<string, UnitConfig>
      resources: unknown
      animals: unknown
      projectiles: unknown
      cells: unknown
    } = {
      buildings: Assets.cache.get('buildingsData'),
      units: Assets.cache.get('unitsData'),
      resources: Assets.cache.get('resourcesData'),
      animals: Assets.cache.get('animalsData'),
      projectiles: Assets.cache.get('projectilesData'),
      cells: Assets.cache.get('cellsData'),
    }

    Assets.cache.set('config', gameConfig)

    this.loadingDiv.remove()
  }
}
