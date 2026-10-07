import { t } from '../../lib/lang'

/** Standalone resource labels; keep t(resource) lowercase inside sentences. */
export function getResourceDisplayName(resource: string): string {
  const label = t(resource)
  return label.charAt(0).toUpperCase() + label.slice(1)
}
