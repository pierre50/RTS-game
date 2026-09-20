import { CELL_DEPTH } from '../../constants/relief'
import type { NeighborFlags } from './topology'

export function getReliefAppearance({
  n,
  s,
  w,
  e,
  nw,
  ne,
  sw,
  se,
}: NeighborFlags): { index: number; elevation: number } | null {
  if (n && !s && !w && !e) {
    return { index: 14, elevation: CELL_DEPTH / 2 }
  } else if (s && !n && !w && !e) {
    return { index: 15, elevation: CELL_DEPTH / 2 }
  } else if (w && !n && !s && !e) {
    return { index: 16, elevation: CELL_DEPTH / 2 }
  } else if (e && !n && !s && !w) {
    return { index: 13, elevation: CELL_DEPTH / 2 }
  } else if (nw && !n && !w) {
    return { index: 10, elevation: CELL_DEPTH / 2 }
  } else if (sw && !s && !w) {
    return { index: 12, elevation: 0 }
  } else if (ne && !n && !e) {
    return { index: 11, elevation: 0 }
  } else if (se && !s && !e) {
    return { index: 9, elevation: CELL_DEPTH / 2 }
  } else if (w && n && !s && !e) {
    return { index: 22, elevation: CELL_DEPTH / 2 }
  } else if (e && s && !n && !w) {
    return { index: 21, elevation: CELL_DEPTH / 2 }
  } else if (w && s && !n && !e) {
    return { index: 23, elevation: CELL_DEPTH }
  } else if (e && n && !s && !w) {
    return { index: 24, elevation: CELL_DEPTH }
  } else if (n && s && !w && !e) {
    return { index: 17, elevation: CELL_DEPTH / 2 }
  } else if (w && e && !n && !s) {
    return { index: 18, elevation: CELL_DEPTH / 2 }
  } else if (n && w) {
    return { index: 22, elevation: CELL_DEPTH / 2 }
  } else if (s && e) {
    return { index: 21, elevation: CELL_DEPTH / 2 }
  } else if (w && s) {
    return { index: 23, elevation: CELL_DEPTH }
  } else if (e && n) {
    return { index: 24, elevation: CELL_DEPTH }
  } else if (n || s) {
    return { index: 17, elevation: CELL_DEPTH / 2 }
  } else if (w || e) {
    return { index: 18, elevation: CELL_DEPTH / 2 }
  }
  return null
}
