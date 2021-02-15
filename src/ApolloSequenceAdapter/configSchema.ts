import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'ApolloSequenceAdapter',
  {
    organismName: {
      type: 'string',
      defaultValue: '',
      description: 'the name of the organism in Apollo',
    },
  },
  { explicitlyTyped: true },
)
