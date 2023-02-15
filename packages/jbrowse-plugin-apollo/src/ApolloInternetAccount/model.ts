import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import { MenuItem } from '@jbrowse/core/ui'
import {
  AbstractSessionModel,
  UriLocation,
  isAbstractMenuManager,
} from '@jbrowse/core/util'
import type AuthenticationPlugin from '@jbrowse/plugin-authentication'
import {
  Change,
  SerializedChange,
  getDecodedToken,
  makeUserSessionId,
} from 'apollo-shared'
import { autorun } from 'mobx'
import { Instance, flow, getRoot, types } from 'mobx-state-tree'
import { io } from 'socket.io-client'

import {
  AddAssembly,
  DeleteAssembly,
  ImportFeatures,
  ManageUsers,
} from '../components'
import { ApolloSessionModel, Collaborator } from '../session'
import { AuthTypeSelector } from './components/AuthTypeSelector'
import { ApolloInternetAccountConfigModel } from './configSchema'

interface Menu {
  label: string
  menuItems: MenuItem[]
}

type AuthType = 'google' | 'microsoft'

type Role = ('admin' | 'user' | 'readOnly')[]

export interface UserLocation {
  assemblyId: string
  refSeq: string
  start: number
  end: number
}

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
        const dec = getDecodedToken(token)
        return dec.roles
      },
      getUserId() {
        const token = self.retrieveToken()
        if (!token) {
          return undefined
        }
        const dec = getDecodedToken(token)
        return dec.id
      },
    }))
    .volatile((self) => ({
      authType: undefined as AuthType | undefined,
      socket: io(self.baseURL),
      lastChangeSequenceNumber: undefined as number | undefined,
    }))
    .actions((self) => ({
      setLastChangeSequenceNumber(sequenceNumber: number) {
        self.lastChangeSequenceNumber = sequenceNumber
      },
    }))
    .actions((self) => ({
      addSocketListeners() {
        const { session } = getRoot(self)
        const { notify } = session
        const token = self.retrieveToken()
        if (!token) {
          throw new Error(`No Token found`)
        }
        const { socket } = self
        const { changeManager } = (session as ApolloSessionModel)
          .apolloDataStore
        socket.on('COMMON', (message) => {
          // Save server last change sequnece into session storage
          sessionStorage.setItem('LastChangeSequence', message.changeSequence)
          if (message.userToken === token) {
            return // we did this change, no need to apply it again
          }
          const change = Change.fromJSON(message.changeInfo)
          changeManager?.submit(change, { submitToBackend: false })
        })
        socket.on('reconnect', () => {
          notify('You are re-connected to the Apollo server.', 'success')
          this.getMissingChanges()
        })
        socket.on('disconnect', () => {
          notify('You are disconnected from the Apollo server.', 'error')
        })
        socket.on('USER_LOCATION', (message) => {
          const { channel, userName, userSessionId, locations } = message
          const user = getDecodedToken(token)
          const localSessionId = makeUserSessionId(user)
          if (channel === 'USER_LOCATION' && userSessionId !== localSessionId) {
            const collaborator: Collaborator = {
              name: userName,
              id: userSessionId,
              locations,
            }
            session.addOrUpdateCollaborator(collaborator)
          }
        })
        socket.on('REQUEST_INFORMATION', (message) => {
          const { channel, userToken, reqType } = message
          if (channel === 'REQUEST_INFORMATION' && userToken !== token) {
            switch (reqType) {
              case 'CURRENT_LOCATION':
                session.broadcastLocations()
                break
            }
          }
        })
      },
      updateLastChangeSequenceNumber: flow(
        function* updateLastChangeSequenceNumber() {
          const { baseURL } = self
          const url = new URL('changes', baseURL)
          const searchParams = new URLSearchParams({ limit: '1' })
          url.search = searchParams.toString()
          const uri = url.toString()
          const apolloFetch = self.getFetcher({
            locationType: 'UriLocation',
            uri,
          })

          const response = yield apolloFetch(uri, {
            method: 'GET',
          })
          if (!response.ok) {
            throw new Error(
              `Error when fetching server LastChangeSequence — ${response.status}`,
            )
          }
          const changes = yield response.json()
          const sequence = changes.length ? changes[0].sequence : 0
          self.setLastChangeSequenceNumber(sequence)
        },
      ),
      getMissingChanges: flow(function* getMissingChanges() {
        const { session } = getRoot(self)
        const { changeManager } = (session as ApolloSessionModel)
          .apolloDataStore
        if (!self.lastChangeSequenceNumber) {
          throw new Error(
            `No LastChangeSequence stored in session. Please, refresh you browser to get last updates from server`,
          )
        }
        const { baseURL } = self

        const url = new URL('changes', baseURL)
        const searchParams = new URLSearchParams({
          since: String(self.lastChangeSequenceNumber),
          sort: '1',
        })
        url.search = searchParams.toString()
        const uri = url.toString()
        const apolloFetch = self.getFetcher({
          locationType: 'UriLocation',
          uri,
        })

        const response = yield apolloFetch(uri, {
          method: 'GET',
        })
        if (!response.ok) {
          console.error(
            `Error when fetching the last updates to recover socket connection — ${response.status}`,
          )
          return
        }
        const serializedChanges = yield response.json()
        serializedChanges.forEach((serializedChange: SerializedChange) => {
          const change = Change.fromJSON(serializedChange)
          changeManager?.submit(change, { submitToBackend: false })
        })
      }),
    }))
    .actions((self) => {
      async function postUserLocation(userLoc: UserLocation[]) {
        const { baseURL } = self
        const url = new URL('users/userLocation', baseURL).href
        const userLocation = new URLSearchParams(JSON.stringify(userLoc))

        const apolloFetch = self.getFetcher({
          locationType: 'UriLocation',
          uri: url,
        })
        try {
          const response = await apolloFetch(url, {
            method: 'POST',
            body: userLocation,
          })
          if (!response.ok) {
            throw new Error() // no message here, will get caught by "catch"
          }
        } catch (error) {
          console.error('Broadcasting user location failed')
        }
      }
      const debounceTimeout = 300
      const debouncePostUserLocation = (
        fn: (userLocation: UserLocation[]) => void,
      ) => {
        let timeoutId: ReturnType<typeof setTimeout>
        return (userLocation: UserLocation[]) => {
          clearTimeout(timeoutId)
          timeoutId = setTimeout(() => fn(userLocation), debounceTimeout)
        }
      }
      return {
        postUserLocation: debouncePostUserLocation(postUserLocation),
      }
    })
    .actions((self) => ({
      addMenuItems(role: Role) {
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
              onClick: (session: ApolloSessionModel) => {
                const { apolloDataStore, notify } = session
                if (apolloDataStore.changeManager.recentChanges.length) {
                  apolloDataStore.changeManager.revertLastChange()
                } else {
                  notify('No changes to undo', 'info')
                }
              },
            },
            10,
          )
        }
      },
      afterAttach() {
        autorun(
          async (reaction) => {
            try {
              const { getRole, authType } = self
              if (!authType) {
                return
              }
              const role = getRole()
              if (role) {
                this.initialize(role)
              }
              reaction.dispose()
            } catch (error) {
              // pass
            }
          },
          { name: 'ApolloInternetAccount' },
        )
      },
      initializeFromToken(token: string) {
        const payload = getDecodedToken(token)
        this.initialize(payload.roles)
      },
      initialize(role: Role) {
        if (role.includes('admin')) {
          this.addMenuItems(role)
        }
        // Get and set server last change sequnece into session storage
        self.updateLastChangeSequenceNumber()
        // Open socket listeners
        self.addSocketListeners()
        // request user locations
        const { baseURL } = self
        const uri = new URL('/users/locations', baseURL).href
        const apolloFetch = self.getFetcher({
          locationType: 'UriLocation',
          uri,
        })
        if (apolloFetch) {
          apolloFetch(uri, {
            method: 'GET',
          })
        }
        window.addEventListener('beforeunload', () => {
          self.postUserLocation([])
        })
        document.addEventListener('visibilitychange', () => {
          // fires when user switches tabs, apps, goes to homescreen, etc.
          if (document.visibilityState === 'hidden') {
            self.postUserLocation([])
          }
          // fires when app transitions from prerender, user returns to the app / tab.
          if (document.visibilityState === 'visible') {
            const { session } = getRoot(self)
            session.broadcastLocations()
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
            return (
              window.location.origin + window.location.pathname.slice(0, -1)
            )
          },
        }))
        .actions((s) => {
          const superStoreToken = s.storeToken
          return {
            storeToken(token: string) {
              superStoreToken(token)
              self.initializeFromToken(token)
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
            return (
              window.location.origin + window.location.pathname.slice(0, -1)
            )
          },
        }))
        .actions((s) => {
          const superStoreToken = s.storeToken
          return {
            storeToken(token: string) {
              superStoreToken(token)
              self.initializeFromToken(token)
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
                        google: Boolean(self.googleClientId),
                        microsoft: Boolean(self.microsoftClientId),
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
