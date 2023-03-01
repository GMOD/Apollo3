import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'ApolloSequenceAdapter',
  {
    assemblyId: {
      type: 'string',
      defaultValue: '',
    },
    baseURL: {
      type: 'fileLocation',
      defaultValue: {
        uri: '',
        locationType: 'UriLocation',
      },
    },
  },
  { explicitlyTyped: true },
)
