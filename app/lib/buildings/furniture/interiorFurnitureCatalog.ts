import { BUILDING_TYPES, CAMP_DECORATION_BUILDING_TYPES } from '../../../constants/entities'

/** Shared catalogue for construction, placement and interior presets. */
/** @public Loaded by tests/interior-construction.test.cjs (loadTsModule). */
export const INTERIOR_FURNITURE_TYPES: readonly string[] = [
  BUILDING_TYPES.chest,
  BUILDING_TYPES.fireCamp,
  ...CAMP_DECORATION_BUILDING_TYPES,
]

export function isInteriorFurniture(type: string): boolean {
  return INTERIOR_FURNITURE_TYPES.includes(type)
}

export function usesInteriorPreset(building: {
  interiorUnfurnished?: boolean
  owner?: { type?: string; isPlayed?: boolean } | null
}): boolean {
  return building.interiorUnfurnished === undefined
    ? building.owner?.type !== 'Human' && !building.owner?.isPlayed
    : !building.interiorUnfurnished
}

export function isInteriorFloorFurniture(type: string): boolean {
  return [BUILDING_TYPES.campHide, BUILDING_TYPES.campRug, BUILDING_TYPES.campFur].includes(type)
}

const FURNITURE_GROUPS = [
  {
    titleKey: 'furnitureCategorySeating',
    types: [
      'CampBedroll',
      'CampBench',
      'CampChair',
      'CampThrone',
      'CampRoundStool',
      'CampSquareStool',
      'CampStumpStool',
    ],
  },
  {
    titleKey: 'furnitureCategoryStorage',
    types: [
      'Chest',
      'CampCrate',
      'CampSupplyShelf',
      'CampBookcase',
      'CampBucket',
      'CampJarSmall',
      'CampJarLarge',
      'CampBlueJar',
      'CampArrowBasket',
      'CampAppleBasket',
      'CampFruitBowl',
    ],
  },
  {
    titleKey: 'furnitureCategoryWork',
    types: [
      'CampTable',
      'CampWorkbench',
      'CampForge',
      'CampAlchemyTable',
      'CampWeavingTable',
      'CampMeatRack',
      'CampDryingRack',
    ],
  },
  { titleKey: 'furnitureCategoryLighting', types: ['FireCamp', 'CampBrazier', 'CampTorchStand'] },
  { titleKey: 'furnitureCategoryFloor', types: ['CampHide', 'CampRug', 'CampFur'] },
]

export const INTERIOR_FURNITURE_CATEGORIES = [
  ...FURNITURE_GROUPS,
  {
    titleKey: 'furnitureCategoryDecoration',
    types: INTERIOR_FURNITURE_TYPES.filter(type => !FURNITURE_GROUPS.some(group => group.types.includes(type))),
  },
]
