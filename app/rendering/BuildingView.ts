import { cartesianToIsometric, getGroundReliefLevel, getInstanceZIndex, getReliefLiftPixels } from '../lib/maths'

export type BuildingAnchorCell = { i: number; j: number; z?: number | null; y?: number; inclined?: boolean | null }

export type BuildingVisualState = {
  cell: { i: number; j: number; z: number }
  position: { x: number; y: number; z: number }
  reliefLift: number
  sortOrder: number
  visible: boolean
}

export type BuildingVisualSource = {
  i: number
  j: number
  zIndexOffset?: number
  type?: string
}

export type BuildingDestructionGroundTarget = { x: number; y: number; zIndex?: number }

/** The anchor cell owns height; map x/y remain flat for gameplay and 3D renderers. */
export function buildingVisualState(
  source: BuildingVisualSource,
  cell: BuildingAnchorCell,
  visible: boolean
): BuildingVisualState {
  const [x, y] = cartesianToIsometric(source.i, source.j)
  const z = cell.z ?? 0
  return {
    cell: { i: cell.i, j: cell.j, z },
    position: { x, y, z },
    reliefLift: -getReliefLiftPixels(getGroundReliefLevel(cell)),
    sortOrder: getInstanceZIndex({ x, y, z, zIndexOffset: source.zIndexOffset, type: source.type }),
    visible,
  }
}

export interface BuildingViewAdapter {
  mount(state: BuildingVisualState): void
  showDestruction(groundTargets: BuildingDestructionGroundTarget[]): void
  drawHealthBar(): void
  drawEnergyBar(): void
  drawHeroPowerBar(ratio: number): void
  removeHealthBar(): void
  removeEnergyBar(): void
  removeHeroPowerBar(): void
}
