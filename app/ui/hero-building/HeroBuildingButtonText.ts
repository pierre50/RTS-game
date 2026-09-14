import { t } from '../../lib/lang'
import type { MenuButtonSpec } from '../../types/ui'

export function buttonTitle(button: MenuButtonSpec): string {
  const details = typeof button.details === 'function' ? button.details() : button.details
  return details?.title || (button.id ? t(button.id) : '')
}

export function buttonMeta(button: MenuButtonSpec, options: { hideMeta?: boolean } = {}): string {
  if (options.hideMeta) return ''
  const details = typeof button.details === 'function' ? button.details() : button.details
  return details?.meta?.filter(Boolean).join(' | ') || details?.description || ''
}
