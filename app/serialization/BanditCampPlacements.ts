import { isObject } from './validation/SaveValidationPrimitives'
import { fail } from './blueprint/MapBlueprintErrors'
import type { BanditCampPlacement } from '../types/camp'

export function decodeBanditCampPlacements(
  value: unknown,
  terrain: string[][],
  caveIds: Set<string>
): BanditCampPlacement[] {
  if (value == null) return []
  if (!Array.isArray(value)) fail('map-invalid', 'Invalid bandit camps')
  const ids = new Set<string>()
  const linkedCaves = new Set<string>()
  return value.map(camp => {
    if (
      !isObject(camp) ||
      !Number.isInteger(camp.i) ||
      !Number.isInteger(camp.j) ||
      !terrain[Number(camp.i)]?.[Number(camp.j)] ||
      terrain[Number(camp.i)][Number(camp.j)] === 'Water'
    )
      fail('map-invalid', 'Invalid camp position')
    if (camp.caveId != null && (typeof camp.caveId !== 'string' || !caveIds.has(camp.caveId)))
      fail('map-invalid', 'Missing camp cave')
    // Legacy regional camps retain their old runtime composition.
    if (camp.profile == null) return camp as BanditCampPlacement
    if (
      !['small', 'lair'].includes(String(camp.profile)) ||
      typeof camp.id !== 'string' ||
      !camp.id ||
      ids.has(camp.id) ||
      !Number.isSafeInteger(camp.seed) ||
      Number(camp.seed) < 0 ||
      !Array.isArray(camp.unitTypes)
    )
      fail('map-invalid', 'Invalid authored camp')
    const units = camp.unitTypes
    if (
      units.some(type => !['BanditChief', 'BanditSword', 'BanditArcher'].includes(String(type))) ||
      units.length < (camp.profile === 'small' ? 2 : 5) ||
      units.length > (camp.profile === 'small' ? 4 : 8)
    )
      fail('map-invalid', 'Invalid camp roster')
    if (camp.profile === 'lair') {
      if (typeof camp.caveId !== 'string' || linkedCaves.has(camp.caveId)) fail('map-invalid', 'Invalid lair cave')
      linkedCaves.add(camp.caveId)
    } else if (camp.caveId != null) fail('map-invalid', 'Small camp cannot occupy a cave')
    ids.add(camp.id)
    return camp as BanditCampPlacement
  })
}
