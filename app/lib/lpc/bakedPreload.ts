import { Assets } from 'pixi.js'
import type { UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import { isAssetCached, loadBakedUnitVariant, registerDynamicEquipmentAliases } from './bakedAliasCache'
import { BAKED_UNITS, bakedVariantKey, gendersForBakedUnit, type BakedUnitType } from './bakedAliases'
import { dynamicEquipmentAsset, dynamicEquipmentAssets, isDynamicEquipmentKey } from './equipment'
import type { DynamicEquipmentAsset } from './equipmentData'
import { heroAppearanceAssetsForPlayers, registerHeroAppearanceAliasesForPlayers } from './heroAppearance'

import { applyBakedLpcUnitAssets } from './bakedUnitAssets'

type PreloadPerformanceMonitor = { record?: (name: string, duration: number) => void }
type BakedPreloadPlayer = Pick<PlayerLike, 'civ' | 'gender' | 'label' | 'heroAppearance'> & {
  corpses?: UnitEntity[]
  units?: UnitEntity[]
}
type EquipmentPreloadOptions = {
  assets?: DynamicEquipmentAsset[]
  batchSize?: number
  yieldBetweenBatches?: boolean
}
type BakedUnitPreloadOptions = {
  villagerCivilizations?: readonly string[]
  preloadEquipment?: boolean
  preloadRuntimeEquipment?: boolean
  runtimeEquipmentBatchSize?: number
}

function waitForIdle(): Promise<void> {
  return new Promise(resolve => {
    const scheduler = globalThis as typeof globalThis & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number
    }
    if (typeof scheduler.requestIdleCallback === 'function') {
      scheduler.requestIdleCallback(resolve, { timeout: 500 })
      return
    }
    globalThis.setTimeout(resolve, 0)
  })
}

async function measurePreload<T>(
  performanceMonitor: PreloadPerformanceMonitor | null | undefined,
  name: string,
  callback: () => Promise<T>
): Promise<T> {
  const startedAt = performance.now()
  try {
    return await callback()
  } finally {
    performanceMonitor?.record?.(name, performance.now() - startedAt)
  }
}

function measurePreloadSync<T>(
  performanceMonitor: PreloadPerformanceMonitor | null | undefined,
  name: string,
  callback: () => T
): T {
  const startedAt = performance.now()
  try {
    return callback()
  } finally {
    performanceMonitor?.record?.(name, performance.now() - startedAt)
  }
}

function unitsForEquipmentPreload(players: BakedPreloadPlayer[]): UnitEntity[] {
  return players.flatMap(player => [...(player.units ?? []), ...(player.corpses ?? [])])
}

function collectBakedLpcRuntimeEquipmentAssets(players: BakedPreloadPlayer[] = []): DynamicEquipmentAsset[] {
  const seen = new Set<string>()
  const assets: DynamicEquipmentAsset[] = []
  for (const unit of unitsForEquipmentPreload(players)) {
    applyBakedLpcUnitAssets(unit)
    for (const layer of unit.appearance?.layers ?? []) {
      const equipment = layer.equipmentKey
      if (!equipment || !isDynamicEquipmentKey(equipment)) continue
      const asset = dynamicEquipmentAsset(equipment)
      if (seen.has(asset.alias)) continue
      seen.add(asset.alias)
      assets.push(asset)
    }
  }
  return assets
}

async function preloadBakedLpcEquipmentAssets(
  players: BakedPreloadPlayer[] = [],
  performanceMonitor?: PreloadPerformanceMonitor | null,
  metricPrefix = 'preloadUnits',
  options: EquipmentPreloadOptions = {}
): Promise<void> {
  const batchSize = Math.max(1, Math.floor(options.batchSize ?? Number.POSITIVE_INFINITY))
  const equipmentAssets = measurePreloadSync(
    performanceMonitor,
    `${metricPrefix}.collectEquipmentAssets`,
    () => options.assets ?? dynamicEquipmentAssets()
  )
  for (let index = 0; index < equipmentAssets.length; index += batchSize) {
    if (options.yieldBetweenBatches) await waitForIdle()
    const batch = equipmentAssets.slice(index, index + batchSize)
    const missingBatch = batch.filter(asset => !isAssetCached(asset.alias))
    if (missingBatch.length) {
      await measurePreload(performanceMonitor, `${metricPrefix}.loadEquipmentAssets`, () => Assets.load(missingBatch))
    }
    const atlasAliases = new Set(batch.map(asset => asset.alias))
    measurePreloadSync(performanceMonitor, `${metricPrefix}.registerEquipmentAliases`, () =>
      registerDynamicEquipmentAliases(atlasAliases)
    )
  }
  measurePreloadSync(performanceMonitor, `${metricPrefix}.resyncUnitTextures`, () => {
    for (const unit of players.flatMap(player => player.units ?? [])) {
      if (unit.currentSheet) unit.setTextures?.(unit.currentSheet)
    }
  })
}

export async function preloadBakedLpcUnitsForPlayers(
  players: BakedPreloadPlayer[],
  performanceMonitor?: PreloadPerformanceMonitor | null,
  options: BakedUnitPreloadOptions = {}
): Promise<void> {
  const variants = new Set<string>()
  measurePreloadSync(performanceMonitor, 'preloadUnits.collectVariants', () => {
    for (const civ of options.villagerCivilizations ?? []) {
      for (const gender of gendersForBakedUnit('villager')) {
        const variant = bakedVariantKey('villager', { civ, label: '' }, `villager:${gender}`, gender)
        variants.add(`villager:${variant}`)
      }
    }
    const appearanceOwners = players.flatMap(player => [
      player,
      ...[...(player.units ?? []), ...(player.corpses ?? [])]
        .filter(unit => unit.assetCiv)
        .map(unit => ({ ...player, civ: unit.assetCiv })),
    ])
    for (const player of appearanceOwners) {
      for (const bakedUnit of BAKED_UNITS) {
        for (const gender of gendersForBakedUnit(bakedUnit)) {
          const variant = bakedVariantKey(bakedUnit, player, `${bakedUnit}:${gender}`, gender)
          variants.add(`${bakedUnit}:${variant}`)
        }
      }
    }
  })

  await measurePreload(performanceMonitor, 'preloadUnits.loadBakedVariants', () =>
    Promise.all(
      [...variants].map(entry => {
        const separator = entry.indexOf(':')
        const unit = entry.slice(0, separator) as BakedUnitType
        const variant = entry.slice(separator + 1)
        return loadBakedUnitVariant(unit, variant)
      })
    )
  )

  if (options.preloadEquipment !== false) {
    await preloadBakedLpcEquipmentAssets(players, performanceMonitor)
  } else if (options.preloadRuntimeEquipment) {
    const runtimeEquipmentAssets = measurePreloadSync(
      performanceMonitor,
      'preloadUnits.collectRuntimeEquipmentAssets',
      () => collectBakedLpcRuntimeEquipmentAssets(players)
    )
    await preloadBakedLpcEquipmentAssets(players, performanceMonitor, 'preloadUnits.runtimeEquipment', {
      assets: runtimeEquipmentAssets,
      batchSize: options.runtimeEquipmentBatchSize ?? Number.POSITIVE_INFINITY,
    })
  }

  const heroAppearanceAssets = measurePreloadSync(performanceMonitor, 'preloadUnits.collectHeroAppearanceAssets', () =>
    heroAppearanceAssetsForPlayers(players)
  )
  if (heroAppearanceAssets.length) {
    await measurePreload(performanceMonitor, 'preloadUnits.loadHeroAppearanceAssets', () =>
      Assets.load(heroAppearanceAssets)
    )
  }
  measurePreloadSync(performanceMonitor, 'preloadUnits.registerHeroAppearanceAliases', () =>
    registerHeroAppearanceAliasesForPlayers(players)
  )
  measurePreloadSync(performanceMonitor, 'preloadUnits.resyncUnitTextures', () => {
    for (const unit of unitsForEquipmentPreload(players)) {
      if (unit.currentSheet) unit.setTextures?.(unit.currentSheet)
    }
  })
}
