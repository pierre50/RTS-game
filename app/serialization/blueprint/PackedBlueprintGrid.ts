/** Array-compatible access to byte-backed blueprint rows, without expanding every byte to a JS slot. */
export function createPackedBlueprintGrid<T>(
  values: Uint8Array | Int8Array,
  stride: number,
  decode: (value: number, index: number) => T,
  present: (index: number) => boolean = () => true,
  cacheDecoded = false
): T[][] {
  return Array.from({ length: stride }, (_, i) => {
    const overrides = new Map<number, T>()
    const deleted = new Set<number>()
    const read = (j: number): T => {
      if (overrides.has(j)) return overrides.get(j)!
      const value = decode(values[i * stride + j], i * stride + j)
      if (cacheDecoded) overrides.set(j, value)
      return value
    }
    const offset = i * stride
    const indexOf = (key: PropertyKey): number =>
      typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key) ? Number(key) : -1
    const exists = (j: number) => j >= 0 && j < stride && !deleted.has(j) && (overrides.has(j) || present(offset + j))
    return new Proxy([] as T[], {
      get(target, key, receiver) {
        if (key === 'length') return stride
        const j = indexOf(key)
        if (j < 0) return Reflect.get(target, key, receiver)
        return exists(j) ? read(j) : undefined
      },
      has(target, key) {
        const j = indexOf(key)
        return j < 0 ? Reflect.has(target, key) : exists(j)
      },
      set(target, key, value, receiver) {
        const j = indexOf(key)
        if (j < 0 || j >= stride) return Reflect.set(target, key, value, receiver)
        deleted.delete(j)
        overrides.set(j, value)
        return true
      },
      deleteProperty(target, key) {
        const j = indexOf(key)
        if (j < 0) return Reflect.deleteProperty(target, key)
        overrides.delete(j)
        deleted.add(j)
        return true
      },
      ownKeys() {
        const keys: string[] = []
        for (let j = 0; j < stride; j++) if (exists(j)) keys.push(String(j))
        keys.push('length')
        return keys
      },
      getOwnPropertyDescriptor(target, key) {
        const j = indexOf(key)
        if (j < 0) return Reflect.getOwnPropertyDescriptor(target, key)
        return exists(j)
          ? {
              configurable: true,
              enumerable: true,
              writable: true,
              value: read(j),
            }
          : undefined
      },
    })
  })
}
