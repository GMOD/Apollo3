import { ConfigurationSchema } from '@jbrowse/core/configuration'

export const apolloRefNameAliasConfigSchema = ConfigurationSchema(
  'ApolloRefNameAliasAdapter',
  {
    aliases: {
      type: 'stringArrayMap',
      defaultValue: {},
    },
  },
  { explicitlyTyped: true },
)
