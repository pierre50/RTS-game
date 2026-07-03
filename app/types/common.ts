export type UnknownRecord = Record<string, unknown>

export type Nullable<T> = T | null

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export type ResourceAmount = Partial<Record<'wood' | 'food' | 'stone' | 'gold', number>>
