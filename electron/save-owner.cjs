// A WebContents survives reloads, while the renderer holding the transaction does not.
function bindSaveOwner(store, owner) {
  const id = owner.id
  let revision = 0
  let pending = Promise.resolve()
  const enqueue = action => {
    const result = pending.then(action)
    pending = result.catch(() => {})
    return result
  }
  const invalidate = () => {
    revision++
    void enqueue(() => store.abortOwner(id)).catch(error => console.error('[save] Owner cleanup failed', error))
  }
  owner.once('destroyed', invalidate)
  owner.on('render-process-gone', invalidate)
  owner.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace) invalidate()
  })
  return {
    begin(key) {
      const requestedRevision = revision
      return enqueue(async () => {
        if (owner.isDestroyed() || requestedRevision !== revision) throw new Error('SAVE_OWNER_CLOSED')
        const result = await store.begin(key, id)
        if (owner.isDestroyed() || requestedRevision !== revision) {
          await store.abort(result.token, id)
          throw new Error('SAVE_OWNER_CLOSED')
        }
        return result
      })
    },
  }
}
module.exports = { bindSaveOwner }
