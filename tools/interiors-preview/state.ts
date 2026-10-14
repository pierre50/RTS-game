import { ENTITY_NAME_TRANSLATIONS } from '../../app/lib/i18n/entityNames'
import type { authoredLayout, sceneFor } from './model'

export type Layout = ReturnType<typeof authoredLayout>
export type Scene = ReturnType<typeof sceneFor>

export interface DragState {
  label: string
  i: number
  j: number
  grabI: number
  grabJ: number
  error: string | null
  before: Layout
}

/** Mutable state shared by the preview modules (single page, single editor). */
export const state = {
  scene: undefined as unknown as Scene,
  revision: '',
  token: '',
  canSave: false,
  saving: false,
  undo: [] as Layout[],
  adding: false,
  drag: null as DragState | null,
  selected: null as string | null,
  offsetX: 500,
  offsetY: 0,
}

export const furnitureName = (type: string) => ENTITY_NAME_TRANSLATIONS.fr[type] ?? type
export const $ = (id: string) => document.getElementById(id) as HTMLInputElement
export const canvas = $('scene') as unknown as HTMLCanvasElement
export const ctx = canvas.getContext('2d')!
export const checked = (id: string) => $(id).checked
export const fail = (error: unknown) => {
  $('error').textContent = String(error)
  $('status').textContent = 'Impossible de générer l’aperçu.'
  $('export').disabled = true
}
