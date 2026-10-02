export type MapBlueprintLoadFailureReason =
  | 'manifest-fetch-failed'
  | 'manifest-invalid'
  | 'size-missing'
  | 'blueprint-id-missing'
  | 'no-compatible-map'
  | 'map-fetch-failed'
  | 'map-invalid'

export class MapBlueprintLoadError extends Error {
  reason: MapBlueprintLoadFailureReason

  constructor(reason: MapBlueprintLoadFailureReason, message: string) {
    super(message)
    this.name = 'MapBlueprintLoadError'
    this.reason = reason
  }
}

export function fail(reason: MapBlueprintLoadFailureReason, message: string): never {
  throw new MapBlueprintLoadError(reason, message)
}
