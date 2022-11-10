import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AbstractSessionModel,
  UriLocation,
  isAbstractMenuManager,
} from '@jbrowse/core/util'
import type AuthenticationPlugin from '@jbrowse/plugin-authentication'
import Undo from '@mui/icons-material/Undo'
import { JWTPayload } from 'apollo-shared'
import jwtDecode from 'jwt-decode'
import { Instance, getRoot, types } from 'mobx-state-tree'

import { AddAssembly, ImportFeatures } from '../components'
import { AuthTypeSelector } from './components/AuthTypeSelector'
import { ApolloInternetAccountConfigModel } from './configSchema'

type AuthType = 'google' | 'microsoft'

const stateModelFactory = (
  configSchema: ApolloInternetAccountConfigModel,
  pluginManager: PluginManager,
) => {
  const AuthPlugin = pluginManager.getPlugin('AuthenticationPlugin') as
    | AuthenticationPlugin
    | undefined
  if (!AuthPlugin) {
    throw new Error('Authentication plugin not found')
  }
  const { OAuthConfigSchema, OAuthInternetAccountModelFactory } =
    AuthPlugin.exports
  return InternetAccount.named('ApolloInternetAccount')
    .props({
      type: types.literal('ApolloInternetAccount'),
      configuration: ConfigurationReference(configSchema),
      authType: types.maybe(types.enumeration(['google', 'microsoft'])),
    })
    .views((self) => ({
      get googleClientId(): string {
        return getConf(self, ['google', 'clientId'])
      },
      get googleAuthEndpoint(): string {
        return getConf(self, ['google', 'authEndpoint'])
      },
      get googleScopes(): string {
        return getConf(self, ['google', 'scopes'])
      },
      get microsoftClientId(): string {
        return getConf(self, ['microsoft', 'clientId'])
      },
      get microsoftAuthEndpoint(): string {
        return getConf(self, ['microsoft', 'authEndpoint'])
      },
      get microsoftScopes(): string {
        return getConf(self, ['microsoft', 'scopes'])
      },
      get internetAccountType() {
        return 'ApolloInternetAccount'
      },
      get baseURL(): string {
        return getConf(self, 'baseURL')
      },
      get role() {
        const token = self.retrieveToken()
        if (!token) {
          return undefined
        }
        const dec = jwtDecode(token) as JWTPayload
        return dec.roles
      },
    }))
    .volatile((self) => ({
      googleAuthInternetAccount: OAuthInternetAccountModelFactory(
        OAuthConfigSchema,
      )
        .views(() => ({
          state() {
            return window.location.origin
          },
        }))
        .create({
          type: 'OAuthInternetAccount',
          configuration: {
            type: 'OAuthInternetAccount',
            internetAccountId: `${self.internetAccountId}-apolloGoogle`,
            name: `${self.name}-apolloGoogle`,
            description: `${self.description}-apolloGoogle`,
            domains: self.domains,
            authEndpoint: self.googleAuthEndpoint,
            clientId: self.googleClientId,
            scopes: self.googleScopes,
          },
        }),
      microsoftAuthInternetAccount: OAuthInternetAccountModelFactory(
        OAuthConfigSchema,
      )
        .views(() => ({
          state() {
            return window.location.origin
          },
        }))
        .create({
          type: 'OAuthInternetAccount',
          configuration: {
            type: 'OAuthInternetAccount',
            internetAccountId: `${self.internetAccountId}-apolloMicrosoft`,
            name: `${self.name}-apolloMicrosoft`,
            description: `${self.description}-apolloMicrosoft`,
            domains: self.domains,
            authEndpoint: self.microsoftAuthEndpoint,
            clientId: 'fabdd045-163c-4712-9d40-dbbb043b3090',
            scopes: self.microsoftScopes,
          },
        }),
    }))
    .actions((self) => ({
      setAuthType(authType: AuthType) {
        self.authType = authType
      },
      retrieveToken() {
        if (self.authType === 'google') {
          return self.googleAuthInternetAccount.retrieveToken()
        }
        if (self.authType === 'microsoft') {
          return self.microsoftAuthInternetAccount.retrieveToken()
        }
        throw new Error(`Unknown authType "${self.authType}"`)
      },
    }))
    .actions((self) => {
      let authTypePromise: Promise<AuthType> | undefined = undefined
      return {
        getFetcher(
          location?: UriLocation,
        ): (input: RequestInfo, init?: RequestInit) => Promise<Response> {
          return async (
            input: RequestInfo,
            init?: RequestInit,
          ): Promise<Response> => {
            let { authType } = self
            if (!authType) {
              if (authTypePromise) {
                authType = await authTypePromise
              } else {
                if (self.googleAuthInternetAccount.retrieveToken()) {
                  authTypePromise = Promise.resolve('google')
                } else if (self.googleAuthInternetAccount.retrieveToken()) {
                  authTypePromise = Promise.resolve('microsoft')
                } else {
                  authTypePromise = new Promise((resolve, reject) => {
                    const { session } = getRoot(self)
                    session.queueDialog((doneCallback: () => void) => [
                      AuthTypeSelector,
                      {
                        baseURL: self.baseURL,
                        name: self.name,
                        handleClose: (newAuthType?: AuthType | Error) => {
                          if (!newAuthType) {
                            reject(new Error('user cancelled entry'))
                          } else if (newAuthType instanceof Error) {
                            reject(newAuthType)
                          } else {
                            resolve(newAuthType)
                          }
                          doneCallback()
                        },
                      },
                    ])
                  })
                }
                authType = await authTypePromise
              }
              self.setAuthType(authType)
            }
            const token = self.retrieveToken()
            if (token) {
              self.storeToken(token)
            }
            if (authType === 'google') {
              return self.googleAuthInternetAccount.getFetcher(location)(
                input,
                init,
              )
            }
            if (authType === 'microsoft') {
              return self.microsoftAuthInternetAccount.getFetcher(location)(
                input,
                init,
              )
            }
            throw new Error(`Unknown authType "${authType}"`)
          }
        },
      }
    })
    .actions((self) => {
      // const { storeToken: superStoreToken } = self
      return {
        storeToken(token: string) {
          // set menu stuff here
          if (isAbstractMenuManager(pluginManager.rootModel)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tmpObj: any = pluginManager.rootModel
            const { menus } = tmpObj
            // Find 'Apollo' menu and its items
            const apolloMenu = menus.find((obj: { label: string }) => {
              return obj.label === 'Apollo'
            })

            if (
              !JSON.stringify(apolloMenu).includes('Add Assembly') &&
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              self.role!.includes('admin')
            ) {
              pluginManager.rootModel.insertInMenu(
                'Apollo',
                {
                  label: 'Add Assembly',
                  onClick: (session: AbstractSessionModel) => {
                    session.queueDialog((doneCallback) => [
                      AddAssembly,
                      {
                        session,
                        handleClose: () => {
                          doneCallback()
                        },
                      },
                    ])
                  },
                },
                0,
              )
              pluginManager.rootModel.insertInMenu(
                'Apollo',
                {
                  label: 'Import Features',
                  onClick: (session: AbstractSessionModel) => {
                    session.queueDialog((doneCallback) => [
                      ImportFeatures,
                      {
                        session,
                        handleClose: () => {
                          doneCallback()
                        },
                      },
                    ])
                  },
                },
                2,
              )
              pluginManager.rootModel.insertInMenu(
                'Apollo',
                {
                  label: 'Undo',
                  onClick: (session: AbstractSessionModel) => {
                    session.queueDialog((doneCallback) => [
                      Undo,
                      {
                        session,
                        handleClose: () => {
                          doneCallback()
                        },
                      },
                    ])
                  },
                },
                10,
              )
            }
          }
        },
        // KS 10.11.2022: Do we need to add menu items here?
        // afterAttach() {
        //   // see if token already exists, if so add menu stuff
        //   if (self.retrieveToken()) {
        //     console.log('TOKEN EXISTS - WE SHOULD SET MENUS')
        //   }
        // },
      }
    })
}

export default stateModelFactory
export type ApolloInternetAccountStateModel = ReturnType<
  typeof stateModelFactory
>
export type ApolloInternetAccountModel =
  Instance<ApolloInternetAccountStateModel>
