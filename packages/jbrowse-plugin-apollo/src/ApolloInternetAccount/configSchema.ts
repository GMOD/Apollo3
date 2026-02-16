import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseInternetAccountConfig } from '@jbrowse/core/pluggableElementTypes'
import type { Instance } from '@jbrowse/mobx-state-tree'

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
  { baseConfiguration: BaseInternetAccountConfig, explicitlyTyped: true },
)

export type ApolloInternetAccountConfigModel = typeof ApolloConfigSchema

// eslint disable because of
// https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ApolloInternetAccountConfig
  extends Instance<ApolloInternetAccountConfigModel> {}
export default ApolloConfigSchema
