import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'ApolloTextSearchAdapter',
  {
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of assemblies covered by text search adapter',
    },
    trackId: {
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
  { explicitlyTyped: true, explicitIdentifier: 'textSearchAdapterId' },
)
