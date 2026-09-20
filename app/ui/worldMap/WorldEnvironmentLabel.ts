import { t } from '../../lib/lang'

export function worldEnvironmentLabel(environment?: string | null): string | null {
  switch (environment) {
    case 'Temperate':
      return t('worldMapEnvironmentTemperate')
    case 'BlackForest':
      return t('worldMapEnvironmentBlackForest')
    case 'Jungle':
      return t('worldMapEnvironmentJungle')
    case 'Desert':
      return t('worldMapEnvironmentDesert')
    case 'Steppe':
      return t('worldMapEnvironmentSteppe')
    default:
      return null
  }
}
