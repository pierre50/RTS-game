import type { UnitConfig } from '../../types/config'

export type LpcSpriteSheetKey =
  | 'standingSheet'
  | 'walkingSheet'
  | 'actionSheet'
  | 'harvestSheet'
  | 'loadedSheet'
  | 'dyingSheet'
  | 'corpseSheet'

export type LpcAnchor = {
  x: number
  y: number
}

export type LpcSheetSource = {
  alias: string
  src: string
}

export type LpcSheetRuntime = LpcSheetSource & {
  frameWidth: number
  frameHeight: number
  directionCount: number
  anchor?: LpcAnchor
  frameIndices?: number[]
  palette?: string
  paletteSize?: number
}

export type LpcAppearanceLayer = {
  zIndex: number
  workTypes?: string[]
  minLevel?: number
  maxLevel?: number
  ageSheetOverrides?: Record<string, Partial<Record<LpcSpriteSheetKey, string>>>
  workSheetOverrides?: Record<string, Partial<Record<LpcSpriteSheetKey, string>>>
  actionWorkSheetOverrides?: Record<string, Partial<Record<LpcSpriteSheetKey, string>>>
  playerColorVariants?: Record<string, string>
  appearanceVariantKey?: string
  sheetDirectionCounts: Partial<Record<LpcSpriteSheetKey, number>>
  palette?: string
  paletteSize?: number
  standingSheet?: string
  walkingSheet?: string
  actionSheet?: string
  harvestSheet?: string
  loadedSheet?: string
  dyingSheet?: string
  corpseSheet?: string
}

export type LpcUnitPreset = {
  sheets: LpcSheetRuntime[]
  unitPatch: Partial<UnitConfig>
  appearance?: {
    layers: LpcAppearanceLayer[]
  }
}
