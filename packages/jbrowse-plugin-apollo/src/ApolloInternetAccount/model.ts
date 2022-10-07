import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes'
import { PayloadObject } from 'apollo-shared/src/Common/payloadObject'
import jwtDecode from 'jwt-decode'
import { Instance, getRoot, types } from 'mobx-state-tree'

import { ApolloLoginForm } from './components/ApolloLoginForm'
import { ApolloInternetAccountConfigModel } from './configSchema'

const stateModelFactory = (configSchema: ApolloInternetAccountConfigModel) => {
  return InternetAccount.named('ApolloInternetAccount')
    .props({
      type: types.literal('ApolloInternetAccount'),
      configuration: ConfigurationReference(configSchema),
      // role: types.array(
      //   types.maybe(types.enumeration('Role', ['admin', 'user', 'readOnly'])),
      // ),
      // role: types.maybe(types.enumeration('Role', ['admin', 'user', 'readOnly'])),
    })
    .views((self) => ({
      get internetAccountType() {
        return 'ApolloInternetAccount'
      },
      get baseURL(): string {
        return getConf(self, 'baseURL')
      },
    }))
    .actions((self) => ({
      // setRole<E extends Record<keyof E, string>>(roles: any) {
      //   self.role = roles
      // },
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
                // const dec = jwtDecode(token) as PayloadObject
                // // decode role from token here and call setRole()
                // console.log(`Set the following roles for user: ${dec.roles}`)
                // this.setRole(dec.roles)
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
