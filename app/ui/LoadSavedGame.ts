import { loadSaveAsync } from '../serialization/SaveStorage'
import { traceLoadAsync } from '../lib/loadDiagnostics'
import { t } from '../lib/lang'
import { GameLoadingScreen } from './GameLoadingScreen'
import type { SaveRecord } from '../types/save'

let loading = false
const paint = (): Promise<void> => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)))

/** Paint before disk access, then yield between batches. The game owns the subsequent restoration screen. */
export async function loadSavedGame(key: string, onLoad: (save: SaveRecord) => void): Promise<void> {
  if (loading) return
  loading = true
  const screen = new GameLoadingScreen('loadingSavedGame')
  try {
    screen.update('readingSave', 0)
    await paint()
    const save = await traceLoadAsync('save.readBlocks', () =>
      loadSaveAsync(key, async (completed, total) => {
        screen.update(`${t('readingSave')} ${completed} / ${total}`, total ? (completed / total) * 0.1 : 0.1)
        await paint()
      })
    )
    onLoad(save)
  } finally {
    screen.destroy()
    loading = false
  }
}
