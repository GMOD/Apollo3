import { baseConnectionConfig } from '@jbrowse/core/pluggableElementTypes/models'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { ApolloConfigurationSchema } from '../globalConfigSchema'

export default ConfigurationSchema(
  'ApolloConnection',
  { apolloConfig: ApolloConfigurationSchema },
  { baseConfiguration: baseConnectionConfig },
)
