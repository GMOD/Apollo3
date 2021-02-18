import { ConfigurationSchema } from '@jbrowse/core/configuration'

export const ApolloConfigurationSchema = ConfigurationSchema(
  'Apollo',
  {
    name: {
      type: 'string',
      defaultValue: '',
    },
    location: {
      type: 'fileLocation',
      defaultValue: { uri: '' },
    },
  },
  { explicitIdentifier: 'apolloId' },
)
