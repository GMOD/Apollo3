import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { ApolloConfigurationSchema } from '../globalConfigSchema'

export default ConfigurationSchema(
  'ApolloAdapter',
  { apolloConfig: ApolloConfigurationSchema },
  { explicitlyTyped: true },
)
