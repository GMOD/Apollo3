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
    allowGuestUser: {
      description: 'Whether to allow a guest user who does not have to log in',
      type: 'boolean',
      defaultValue: true,
    },
    google: ConfigurationSchema('ApolloGoogleInternetAccount', {
      authEndpoint: {
        description: 'the authorization code endpoint of the internet account',
        type: 'string',
        defaultValue: '',
      },
    }),
    microsoft: ConfigurationSchema('ApolloMicrosoftInternetAccount', {
      authEndpoint: {
        description: 'the authorization code endpoint of the internet account',
        type: 'string',
        defaultValue: '',
      },
    }),
  },
  { baseConfiguration: BaseInternetAccountConfig, explicitlyTyped: true },
)

export type ApolloInternetAccountConfigModel = typeof ApolloConfigSchema

export type ApolloInternetAccountConfig =
  Instance<ApolloInternetAccountConfigModel>
export default ApolloConfigSchema
