import { Assets, Container } from 'pixi.js'
import { t } from '../lib/lang'
import { ASSET_BUNDLES, ASSET_LOAD_SEQUENCE } from '../config/assetManifest'

/**
 * Loading Screen
 *
 * @exports LoaderScreen
 */

export default class LoaderScreen extends Container {
  constructor() {
    super()
    this.app

    this.loadingDiv = document.createElement('div')
    this.loadingDiv.className = 'loading'
    document.body.prepend(this.loadingDiv)
    this.done = () => {}
  }

  async start() {
    Object.entries(ASSET_BUNDLES).forEach(([bundleName, assets]) => {
      Assets.addBundle(bundleName, assets)
    })

    for (const { bundle, messageKey } of ASSET_LOAD_SEQUENCE) {
      this.loadingDiv.innerHTML = t(messageKey)
      await Assets.loadBundle(bundle)
    }

    Assets.cache.set('config', {
      buildings: Assets.cache.get('buildingsData'),
      units: Assets.cache.get('unitsData'),
      resources: Assets.cache.get('resourcesData'),
      animals: Assets.cache.get('animalsData'),
      projectiles: Assets.cache.get('projectilesData'),
      cells: Assets.cache.get('cellsData'),
    })

    this.loadingDiv.remove()
  }
}
