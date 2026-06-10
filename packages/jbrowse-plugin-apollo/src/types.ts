import type { BaseInternetAccountModel } from '@jbrowse/core/pluggableElementTypes'
import type { AppRootModel } from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'

import type { ApolloInternetAccountModel } from './ApolloInternetAccount/model'
import type { ApolloSessionModel } from './session'

export interface ApolloRootModel extends Omit<AppRootModel, 'session'> {
  session: ApolloSessionModel
  internetAccounts: (BaseInternetAccountModel | ApolloInternetAccountModel)[]
}

export function isApolloInternetAccount(
  internetAccount: BaseInternetAccountModel | ApolloInternetAccountModel,
): internetAccount is ApolloInternetAccountModel {
  try {
    if (!isAlive(internetAccount)) {
      return false
    }
    return internetAccount.type === 'ApolloInternetAccount'
  } catch {
    return false
  }
}
