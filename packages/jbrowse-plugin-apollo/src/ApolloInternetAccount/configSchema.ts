import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { Instance } from 'mobx-state-tree'
import { BaseInternetAccountConfig } from '@jbrowse/core/pluggableElementTypes/models'

const ApolloConfigSchema = ConfigurationSchema(
  'ApolloInternetAccount',
  {
    authHeader: {
      description: 'custom auth header for authorization',
      type: 'string',
      defaultValue: 'Authorization',
    },
    domains: {
      description:
        'array of valid domains the url can contain to use this account. Empty = all domains',
      type: 'stringArray',
      defaultValue: [],
    },
  },
  {
    baseConfiguration: BaseInternetAccountConfig,
    explicitlyTyped: true,
  },
)

export type ApolloInternetAccountConfigModel = typeof ApolloConfigSchema

export type ApolloInternetAccountConfig = Instance<
  ApolloInternetAccountConfigModel
>
export default ApolloConfigSchema
