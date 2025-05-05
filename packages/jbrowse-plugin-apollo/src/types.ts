import { type BaseInternetAccountModel } from '@jbrowse/core/pluggableElementTypes'
import { type AppRootModel } from '@jbrowse/core/util'

import { type ApolloInternetAccountModel } from './ApolloInternetAccount/model'
import { type ApolloSessionModel } from './session'

export interface ApolloRootModel extends Omit<AppRootModel, 'session'> {
  session: ApolloSessionModel
  internetAccounts: (BaseInternetAccountModel | ApolloInternetAccountModel)[]
}
