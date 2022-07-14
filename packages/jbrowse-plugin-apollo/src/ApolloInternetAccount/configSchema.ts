import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseInternetAccountConfig } from '@jbrowse/core/pluggableElementTypes'
import { Instance } from 'mobx-state-tree'

const ApolloConfigSchema = ConfigurationSchema(
  'ApolloInternetAccount',
  {
    baseURL: {
      description: 'Location of Apollo server',
      type: 'string',
      defaultValue: '',
    },
    tokenType: {
      description: 'A custom name for a token to include in the header',
      type: 'string',
      defaultValue: 'Bearer',
    },
  },
  {
    baseConfiguration: BaseInternetAccountConfig,
    explicitlyTyped: true,
  },
)

export type ApolloInternetAccountConfigModel = typeof ApolloConfigSchema

export type ApolloInternetAccountConfig =
  Instance<ApolloInternetAccountConfigModel>
export default ApolloConfigSchema
