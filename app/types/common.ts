export type UnknownRecord = Record<string, unknown>
export type DynamicValue = ReturnType<typeof JSON.parse>
export type LooseRecord = Record<string, DynamicValue>

export type ResourceAmount = Partial<Record<'wood' | 'food' | 'stone' | 'gold', number>>
