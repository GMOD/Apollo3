import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import { UriLocation } from '@jbrowse/core/util'
import { JWTPayload } from 'apollo-shared'
import jwtDecode from 'jwt-decode'
import { Instance, getRoot, types } from 'mobx-state-tree'

import { AuthTypeSelector } from './components/AuthTypeSelector'
import { ApolloInternetAccountConfigModel } from './configSchema'

type AuthType = 'google'

const stateModelFactory = (
  configSchema: ApolloInternetAccountConfigModel,
  pluginManager: PluginManager,
) => {
  const AuthPlugin = pluginManager.getPlugin('AuthenticationPlugin') as
    | any
    | undefined
  if (!AuthPlugin) {
    throw new Error('LinearGenomeView plugin not found')
  }
  const { OAuthConfigSchema, OAuthInternetAccountModelFactory } =
    AuthPlugin.exports
  return InternetAccount.named('ApolloInternetAccount')
    .props({
      type: types.literal('ApolloInternetAccount'),
      configuration: ConfigurationReference(configSchema),
      authType: types.maybe(types.enumeration(['google'])),
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
    }))
    .volatile((self) => ({
      googleAuthInternetAccount: OAuthInternetAccountModelFactory(
        OAuthConfigSchema,
      ).create({
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
    }))
    .views((self) => ({
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
    .actions((self) => ({
      setAuthType(authType: AuthType) {
        self.authType = authType
      },
      retrieveToken() {
        if (self.authType === 'google') {
          return self.googleAuthInternetAccount.retrieveToken()
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
                authTypePromise = new Promise((resolve, reject) => {
                  const { session } = getRoot(self)
                  session.queueDialog((doneCallback: () => void) => [
                    AuthTypeSelector,
                    {
                      baseURL: self.baseURL,
                      name: self.name,
                      handleClose: (token?: AuthType | Error) => {
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
                })
                authType = await authTypePromise
              }
              self.setAuthType(authType)
            }
            if (authType === 'google') {
              return self.googleAuthInternetAccount.getFetcher(location)(
                input,
                init,
              )
            }
            throw new Error(`Unknown authType "${authType}"`)
          }
        },
      }
    })
}

export default stateModelFactory
export type ApolloInternetAccountStateModel = ReturnType<
  typeof stateModelFactory
>
export type ApolloInternetAccountModel =
  Instance<ApolloInternetAccountStateModel>
