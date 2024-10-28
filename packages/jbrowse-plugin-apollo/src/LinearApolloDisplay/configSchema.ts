import { ConfigurationSchema } from '@jbrowse/core/configuration'

export const configSchema = ConfigurationSchema(
  'LinearApolloDisplay',
  {},
  { explicitIdentifier: 'displayId', explicitlyTyped: true },
)
