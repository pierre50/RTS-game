export function playableColor(color?: string | null, fallback = 'violet'): string {
  if (!color || ['grey', 'gray', 'black'].includes(color.toLowerCase())) return fallback
  return color
}
