import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { ApolloConfigurationSchema } from '../globalConfigSchema'

export default ConfigurationSchema(
  'ApolloSequenceAdapter',
  {
    organismName: {
      type: 'string',
      defaultValue: '',
      description: 'the name of the organism in Apollo',
    },
    apolloConfig: ApolloConfigurationSchema,
  },
  { explicitlyTyped: true },
)
