import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'ApolloRefNameAliasAdapter',
  {
    assemblyId: {
      type: 'string',
      defaultValue: '',
    },
  },
  { explicitlyTyped: true },
)
