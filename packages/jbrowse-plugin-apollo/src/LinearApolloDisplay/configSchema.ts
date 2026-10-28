import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { featureDensityConfigSlots } from '../util/featureDensityModel'

export const configSchema = ConfigurationSchema(
  'LinearApolloDisplay',
  featureDensityConfigSlots,
  { explicitIdentifier: 'displayId', explicitlyTyped: true },
)
