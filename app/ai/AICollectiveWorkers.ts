import type { UnitEntity } from '../types/entities'
import type { AIEntityLike } from './types'

/** End the economic task, but deliver its cargo before accepting another one. */
export function releaseCollectiveWorker(worker: AIEntityLike, available: AIEntityLike[]): void {
  worker.stop?.()
  worker.autonomousJob = null
  worker.work = null
  worker.previousWork = null
  worker.previousDest = null
  worker.dest = null
  const unit = worker as UnitEntity
  if (Object.values(unit.inventory?.resources ?? {}).some(amount => (amount ?? 0) > 0)) {
    unit.sendToDelivery?.()
    return
  }
  if (!available.includes(worker)) available.push(worker)
}
