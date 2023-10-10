import { BaseInternetAccountModel } from '@jbrowse/core/pluggableElementTypes'
import { AppRootModel } from '@jbrowse/core/util'

import { ApolloInternetAccountModel } from './ApolloInternetAccount/model'
import { ApolloSessionModel } from './session'

export interface ApolloRootModel extends Omit<AppRootModel, 'session'> {
  session: ApolloSessionModel
  internetAccounts: (BaseInternetAccountModel | ApolloInternetAccountModel)[]
}
