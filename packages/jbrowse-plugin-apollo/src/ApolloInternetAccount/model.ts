import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import { MenuItem } from '@jbrowse/core/ui'
import {
  AbstractSessionModel,
  AppRootModel,
  UriLocation,
  isAbstractMenuManager,
} from '@jbrowse/core/util'
import type AuthenticationPlugin from '@jbrowse/plugin-authentication'
import Undo from '@mui/icons-material/Undo'
import { Change, JWTPayload, SerializedChange } from 'apollo-shared'
import jwtDecode from 'jwt-decode'
import { autorun } from 'mobx'
import { Instance, getRoot, types } from 'mobx-state-tree'
import { Socket, io } from 'socket.io-client'

import {
  AddAssembly,
  DeleteAssembly,
  ImportFeatures,
  ManageUsers,
} from '../components'
import { ApolloSession, ApolloSessionModel } from '../session'
import { AuthTypeSelector } from './components/AuthTypeSelector'
import { ApolloInternetAccountConfigModel } from './configSchema'

interface Menu {
  label: string
  menuItems: MenuItem[]
}

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
      getRole() {
        const token = self.retrieveToken()
        if (!token) {
          return undefined
        }
        const dec = jwtDecode(token) as JWTPayload
        return dec.roles
      },
      getUserId() {
        const token = self.retrieveToken()
        if (!token) {
          return undefined
        }
        const dec = jwtDecode(token) as JWTPayload
        return dec.id
      },
    }))
    .volatile((self) => ({
      authType: undefined as AuthType | undefined,
      socket: io(self.baseURL),
    }))
    .actions((self) => ({
      addMenuItems(role: ('admin' | 'user' | 'readOnly')[]) {
        if (
          !(
            role.includes('admin') &&
            isAbstractMenuManager(pluginManager.rootModel)
          )
        ) {
          return
        }
        const { rootModel } = pluginManager
        const { menus } = rootModel as unknown as { menus: Menu[] }
        // Find 'Apollo' menu and its items
        const apolloMenu = menus.find((menu) => {
          return menu.label === 'Apollo'
        })
        if (!apolloMenu) {
          return
        }
        const { menuItems } = apolloMenu
        if (
          !menuItems.find(
            (menuItem) =>
              'label' in menuItem && menuItem.label === 'Add Assembly',
          )
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
                    changeManager: (session as ApolloSessionModel)
                      .apolloDataStore.changeManager,
                  },
                ])
              },
            },
            0,
          )
          pluginManager.rootModel.insertInMenu(
            'Apollo',
            {
              label: 'Delete Assembly',
              onClick: (session: AbstractSessionModel) => {
                session.queueDialog((doneCallback) => [
                  DeleteAssembly,
                  {
                    session,
                    handleClose: () => {
                      doneCallback()
                    },
                    changeManager: (session as ApolloSessionModel)
                      .apolloDataStore.changeManager,
                  },
                ])
              },
            },
            1,
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
                    changeManager: (session as ApolloSessionModel)
                      .apolloDataStore.changeManager,
                  },
                ])
              },
            },
            2,
          )
          pluginManager.rootModel.insertInMenu(
            'Apollo',
            {
              label: 'Manage Users',
              onClick: (session: AbstractSessionModel) => {
                session.queueDialog((doneCallback) => [
                  ManageUsers,
                  {
                    session,
                    handleClose: () => {
                      doneCallback()
                    },
                    changeManager: (session as ApolloSessionModel)
                      .apolloDataStore.changeManager,
                  },
                ])
              },
            },
            9,
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
                    changeManager: (session as ApolloSessionModel)
                      .apolloDataStore.changeManager,
                  },
                ])
              },
            },
            10,
          )
        }
      },
      afterAttach() {
        autorun(async (reaction) => {
          try {
            const { getRole, authType } = self
            if (!authType) {
              return
            }
            const { session } = getRoot(self)
            openSocket(session, self.socket)
            const role = getRole()
            if (role?.includes('admin')) {
              this.addMenuItems(role)
              reaction.dispose()
            }
          } catch (error) {
            // pass
          }
        })
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
        .actions((s) => {
          const superStoreToken = s.storeToken
          return {
            async storeToken(token: string) {
              superStoreToken(token)
              const payload = jwtDecode(token) as JWTPayload
              if (payload.roles.includes('admin')) {
                self.addMenuItems(payload.roles)
              }
              const { session } = getRoot(self)
              // Get and set server last change sequnece into session storage
              await getAndSetLastChangeSeq(session)
              // Open socket listeners
              openSocket(session, self.socket)
            },
          }
        })
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
        .actions((s) => {
          const superStoreToken = s.storeToken
          return {
            async storeToken(token: string) {
              superStoreToken(token)
              const payload = jwtDecode(token) as JWTPayload
              if (payload.roles.includes('admin')) {
                self.addMenuItems(payload.roles)
              }
              const { session } = getRoot(self)
              // Get and set server last change sequnece into session storage
              await getAndSetLastChangeSeq(session)
              // Open socket listeners
              openSocket(session, self.socket)
            },
          }
        })
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      postUserLocation(session: ApolloSession, userLoc: any) {
        const { internetAccounts } = getRoot(session) as AppRootModel
        const internetAccount =
          internetAccounts[0] as ApolloInternetAccountModel
        const { baseURL } = internetAccount
        const url = new URL('users/userLocation', baseURL).href
        const userLocation = new URLSearchParams(userLoc)
        const apolloFetchFile = internetAccount?.getFetcher({
          locationType: 'UriLocation',
          uri: url,
        })
        if (apolloFetchFile) {
          apolloFetchFile(url, {
            method: 'POST',
            body: userLocation,
          })
        }
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
            }
            self.setAuthType(authType)
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
}

export default stateModelFactory
export type ApolloInternetAccountStateModel = ReturnType<
  typeof stateModelFactory
>
export type ApolloInternetAccountModel =
  Instance<ApolloInternetAccountStateModel>

/**
 *  Get and set server last change sequnece into session storage
 * @param apolloInternetAccount - apollo internet account
 * @returns
 */
async function getAndSetLastChangeSeq(session: ApolloSession) {
  const { internetAccounts } = getRoot(session) as AppRootModel
  const internetAccount = internetAccounts[0] as ApolloInternetAccountModel
  const { baseURL } = internetAccount
  const url = new URL('changes', baseURL)
  const searchParams = new URLSearchParams({
    limit: '1',
  })
  url.search = searchParams.toString()
  const uri = url.toString()
  const apolloFetch = internetAccount.getFetcher({
    locationType: 'UriLocation',
    uri,
  })

  const response = await apolloFetch(uri, {
    method: 'GET',
  })
  if (!response.ok) {
    throw new Error(
      `Error when fetching server LastChangeSequence — ${response.status}`,
    )
  }
  const change = await response.json()
  sessionStorage.setItem('LastChangeSequence', change[0].sequence)
}

function openSocket(session: ApolloSession, socket: Socket) {
  const { internetAccounts } = getRoot(session) as AppRootModel
  const internetAccount = internetAccounts[0] as ApolloInternetAccountModel
  const { baseURL } = internetAccount
  const { notify } = session
  const token = internetAccount.retrieveToken()
  if (!token) {
    throw new Error(`No Token found`)
  }
  const { changeManager } = (session as ApolloSessionModel).apolloDataStore
  if (!socket.hasListeners('COMMON')) {
    console.log(`User starts to listen "COMMON" at ${baseURL}`)
    socket.on('COMMON', (message) => {
      // Save server last change sequnece into session storage
      sessionStorage.setItem('LastChangeSequence', message.changeSequence)
      if (message.channel === 'COMMON' && message.userToken !== token) {
        const change = Change.fromJSON(message.changeInfo)
        changeManager?.submit(change, {
          submitToBackend: false,
        })
        notify(
          `${JSON.stringify(message.userName)} changed : ${JSON.stringify(
            message.changeInfo,
          )}`,
          'success',
        )
      }
    })
    socket.on('connect', function () {
      console.log('Connected')
      notify(`You are re-connected to Apollo server.`, 'success')
      getLastUpdates(session, socket)
    })
    socket.on('disconnect', function () {
      console.log('Disconnected')
      notify(
        `You are disconnected from Apollo server! Please, close this message`,
        'error',
      )
    })
    console.log(
      `LastChangeSequence: '${sessionStorage.getItem('LastChangeSequence')}'`,
    )
  }
  if (!socket.hasListeners('USER_LOCATION')) {
    console.log(`User starts to listen "USER_LOCATION" at ${baseURL}`)
    socket.on('USER_LOCATION', (message) => {
      if (message.channel === 'USER_LOCATION' && message.userToken !== token) {
        console.log(
          `User's ${JSON.stringify(message.userName)} location. AssemblyId: "${
            message.assemblyId
          }", refSeq: "${message.refSeq}", start: "${
            message.start
          }" and end: "${message.end}"`,
        )
      }
    })
  }
}

/**
 * Start to listen temporary channel, fetch the last changes from server and finally apply those changes to client data store
 * @param apolloInternetAccount - apollo internet account
 * @returns
 */
async function getLastUpdates(session: ApolloSession, socket: Socket) {
  const lastChangeSequence = sessionStorage.getItem('LastChangeSequence')
  if (!lastChangeSequence) {
    throw new Error(
      `No LastChangeSequence stored in session. Please, refresh you browser to get last updates from server`,
    )
  }
  const { notify } = session
  const { changeManager } = (session as ApolloSessionModel).apolloDataStore
  const channel = `tmp_${Math.floor(Math.random() * (10000 - 1000 + 1) + 1000)}`
  // Let's start to listen temporary channel where server will send the last updates
  socket.on(channel, (message) => {
    const change = Change.fromJSON(message.changeInfo[0])
    changeManager?.submit(change, { submitToBackend: false })
    notify(
      `Get the last updates from server: ${JSON.stringify(message.changeInfo)}`,
      'success',
    )
  })
  const { internetAccounts } = getRoot(session) as AppRootModel
  const internetAccount = internetAccounts[0] as ApolloInternetAccountModel
  const { baseURL } = internetAccount

  const url = new URL('changes', baseURL)
  const searchParams = new URLSearchParams({
    since: lastChangeSequence,
    sort: '1',
  })
  url.search = searchParams.toString()
  const uri = url.toString()
  const apolloFetch = internetAccount.getFetcher({
    locationType: 'UriLocation',
    uri,
  })

  // TODO apply these changes
  const response = await apolloFetch(uri, {
    method: 'GET',
  })
  if (!response.ok) {
    console.log(
      `Error when fetching the last updates to recover socket connection — ${response.status}`,
    )
    return
  }
  const serializedChanges = await response.json()
  serializedChanges.forEach((serializedChange: SerializedChange) => {
    const change = Change.fromJSON(serializedChange)
    changeManager?.submit(change, { submitToBackend: false })
  })
}
