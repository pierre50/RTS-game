import { createSeededRandom } from '../../../lib/random'
import { isLiving } from '../offline/OfflineWorldSpatial'
import { findStartingSite, type StartingVillage } from './StartingVillageContext'
import type { SaveEntityState, SaveGridPoint } from '../../../types/save'

// A field is a patch of individual crops, independent of the one-cell sowing footprint.
const FIELD_SIZE = 3
const BEFORE = Math.floor((FIELD_SIZE - 1) / 2)
const AFTER = FIELD_SIZE - BEFORE - 1

/** Reserve agriculture before other buildings, decorations and newly spawned units
 * fragment the remaining free terrain. */
export function addStartingWheatFields(village: StartingVillage): void {
  const fields = village.profile.wheatFields ?? 0
  if (!Number.isInteger(fields) || fields < 0 || fields > 20) throw new Error('Invalid starting wheat field count')
  const granary =
    village.buildings.find(building => building.type === 'Granary' && isLiving(building)) ?? village.center
  for (let field = 0; field < fields; field++) {
    const point = findStartingSite(village, granary, FIELD_SIZE, 'Farm')
    if (!point) throw new Error(`No space for starting wheat field in ${village.player.civ}`)
    village.layout.recordSite(village.center, 'Farm', point, FIELD_SIZE)
    plantWheatField(village, point, field)
  }
}

function youngCropCells(random: () => number): Set<number> {
  const cropOrder = Array.from({ length: FIELD_SIZE * FIELD_SIZE }, (_, crop) => crop)
  for (let crop = cropOrder.length - 1; crop > 0; crop--) {
    const other = Math.floor(random() * (crop + 1))
    ;[cropOrder[crop], cropOrder[other]] = [cropOrder[other], cropOrder[crop]]
  }
  return new Set(cropOrder.slice(0, 1 + Math.floor(random() * 4)))
}

function plantWheatField(village: StartingVillage, point: SaveGridPoint, field: number): void {
  const owner = village.player.label ?? village.index
  const youngCrops = youngCropCells(createSeededRandom(`wheat:${owner}:${point.i}:${point.j}:${field}`))
  for (let i = point.i - BEFORE; i <= point.i + AFTER; i++) {
    for (let j = point.j - BEFORE; j <= point.j + AFTER; j++) {
      const wheat: SaveEntityState = {
        i,
        j,
        type: 'Wheat',
        label: `start:${owner}:wheat:${field}:${i}:${j}`,
        // An unspecified saved growth frame restores as mature using the loaded sprite.
        // Asset caches may not yet know the final frame during village generation.
        // Scatter one to four young crops throughout each patch, including its center.
        ...(youngCrops.has((i - point.i + BEFORE) * FIELD_SIZE + j - point.j + BEFORE) ? { currentFrame: 0 } : {}),
        quantity: 10,
        totalQuantity: 10,
      }
      village.state.resources.push(wheat)
      village.spatial.reserve(wheat)
    }
  }
}
