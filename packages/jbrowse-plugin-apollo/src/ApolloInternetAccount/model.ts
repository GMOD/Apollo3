import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import { Instance, getRoot, types } from 'mobx-state-tree'

import { ApolloLoginForm } from './components/ApolloLoginForm'
import { ApolloInternetAccountConfigModel } from './configSchema'

const stateModelFactory = (configSchema: ApolloInternetAccountConfigModel) => {
  return types
    .compose(
      'ApolloInternetAccount',
      InternetAccount,
      types.model({
        id: 'Apollo',
        type: types.literal('ApolloInternetAccount'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .views((self) => ({
      get internetAccountType() {
        return 'ApolloInternetAccount'
      },
      get baseURL(): string {
        return getConf(self, 'baseURL')
      },
    }))
    .actions((self) => ({
      getTokenFromUser(
        resolve: (token: string) => void,
        reject: (error: Error) => void,
      ) {
        const { session } = getRoot(self)
        session.queueDialog((doneCallback: () => void) => [
          ApolloLoginForm,
          {
            baseURL: self.baseURL,
            internetAccountId: self.internetAccountId,
            handleClose: (token?: string | Error) => {
              if (!token) {
                reject(new Error('user cancelled entry'))
              } else if (token instanceof Error) {
                reject(token)
              } else {
                resolve(token)
              }
              doneCallback()
            },
          },
        ])
      },
    }))
}

export default stateModelFactory
export type ApolloInternetAccountStateModel = ReturnType<
  typeof stateModelFactory
>
export type ApolloInternetAccountModel =
  Instance<ApolloInternetAccountStateModel>
