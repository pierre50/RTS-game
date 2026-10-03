import { Assets, Container } from 'pixi.js'
import { t } from '../lib/lang'
import { ASSET_BUNDLES, ASSET_LOAD_SEQUENCE } from '../config/assetManifest'
import { registerAnimalSheetAliases } from '../lib/animals/aliases'
import type { AnimalConfigMap } from '../lib/animals/aliases'
import type { UnitConfig } from '../types/config'
import type { SpritesheetLike } from '../types/pixi'

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
      if (bundle === 'graphics') {
        registerProjectileSheetAliases()
      }
    }

    const gameConfig: {
      buildings: unknown
      units: Record<string, UnitConfig>
      resources: unknown
      animals: AnimalConfigMap | undefined
      projectiles: unknown
      equipment: unknown
      cells: unknown
    } = {
      buildings: Assets.cache.get('buildingsData'),
      units: Assets.cache.get('unitsData'),
      resources: Assets.cache.get('resourcesData'),
      animals: Assets.cache.get('animalsData') as AnimalConfigMap | undefined,
      projectiles: Assets.cache.get('projectilesData'),
      equipment: Assets.cache.get('equipmentData'),
      cells: Assets.cache.get('cellsData'),
    }

    registerAnimalSheetAliases(gameConfig.animals)

    Assets.cache.set('config', gameConfig)

    this.loadingDiv.remove()
  }
}

const PROJECTILE_ATLAS_ALIAS = 'projectiles'
const PROJECTILE_VARIANTS = ['ceramic', 'copper', 'bronze', 'iron'] as const

function registerProjectileSheetAliases(): void {
  const atlas = Assets.cache.get(PROJECTILE_ATLAS_ALIAS) as SpritesheetLike | undefined
  if (!atlas?.textures) return

  for (const variant of PROJECTILE_VARIANTS) {
    const alias = `${PROJECTILE_ATLAS_ALIAS}/arrow_${variant}`
    const framePattern = `_graphics_projectiles_arrow_${variant}.png`
    const textures = Object.fromEntries(
      Object.entries(atlas.textures).filter(([frameName]) => frameName.endsWith(framePattern))
    )
    const frames = Object.fromEntries(
      Object.entries(atlas.data?.frames ?? {}).filter(([frameName]) => frameName.endsWith(framePattern))
    )

    Assets.cache.set(alias, {
      ...atlas,
      data: {
        ...atlas.data,
        frames,
      },
      textures,
    })
  }
}
