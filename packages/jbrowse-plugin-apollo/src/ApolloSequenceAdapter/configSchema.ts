import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'ApolloSequenceAdapter',
  {
    assemblyId: {
      type: 'string',
      defaultValue: '',
    },
  },
  { explicitlyTyped: true },
)
