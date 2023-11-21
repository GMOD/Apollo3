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
import { Change } from 'apollo-common'
import {
  ChangeMessage,
  CheckResultUpdate,
  RequestUserInformationMessage,
  UserLocation,
  UserLocationMessage,
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
import { ApolloRootModel } from '../types'
import { createFetchErrorMessage } from '../util'
import { AuthTypeSelector } from './components/AuthTypeSelector'
import { ApolloInternetAccountConfigModel } from './configSchema'

interface Menu {
  label: string
  menuItems: MenuItem[]
}

type AuthType = 'google' | 'microsoft' | 'guest'

type Role = 'admin' | 'user' | 'readOnly'

const inWebWorker = typeof sessionStorage === 'undefined'

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
      get microsoftClientId(): string {
        return getConf(self, ['microsoft', 'clientId'])
      },
      get microsoftAuthEndpoint(): string {
        return getConf(self, ['microsoft', 'authEndpoint'])
      },
      get internetAccountType() {
        return 'ApolloInternetAccount'
      },
      get baseURL(): string {
        return getConf(self, 'baseURL')
      },
      get allowGuestUser(): boolean {
        return getConf(self, 'allowGuestUser')
      },
      getUserId() {
        const token = self.retrieveToken()
        if (!token) {
          return
        }
        const dec = getDecodedToken(token)
        return dec.id
      },
    }))
    .actions((self) => {
      let roleNotificationSent = false
      return {
        getRole() {
          const token = self.retrieveToken()
          if (!token) {
            return
          }
          const dec = getDecodedToken(token)
          const { role } = dec
          if (!role && !roleNotificationSent) {
            const { session } = getRoot<ApolloRootModel>(self)
            ;(session as unknown as AbstractSessionModel).notify(
              'You have registered as a user but have not been given access. Ask your administrator to enable access for your account.',
              'warning',
            )
            // notify
            roleNotificationSent = true
          }
          return role
        },
      }
    })
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
      async getTokenFromUser(
        resolve: (token: string) => void,
        reject: (error: Error) => void,
      ): Promise<void> {
        const { baseURL } = self
        const url = new URL('auth/guest', baseURL)
        const response = await fetch(url)
        if (!response.ok) {
          const errorMessage = await createFetchErrorMessage(
            response,
            'Error when logging in as guest',
          )
          return reject(new Error(errorMessage))
        }
        const { token } = await response.json()
        resolve(token)
      },
      addSocketListeners() {
        const { session } = getRoot<ApolloRootModel>(self)
        const { notify } = session as unknown as AbstractSessionModel
        const token = self.retrieveToken()
        if (!token) {
          throw new Error('No Token found')
        }
        const { socket } = self
        const { addCheckResult, changeManager, deleteCheckResult } = (
          session as ApolloSessionModel
        ).apolloDataStore
        socket.on('connect', async () => {
          await this.getMissingChanges()
        })
        socket.on('connect_error', () => {
          notify('Could not connect to the Apollo server.', 'error')
        })
        socket.on('COMMON', (message: ChangeMessage | CheckResultUpdate) => {
          if ('checkResult' in message) {
            if (message.deleted) {
              deleteCheckResult(message.checkResult._id.toString())
            } else {
              addCheckResult(message.checkResult)
            }
            return
          }
          // Save server last change sequence into session storage
          sessionStorage.setItem(
            'LastChangeSequence',
            String(message.changeSequence),
          )
          if (message.userSessionId === token) {
            return // we did this change, no need to apply it again
          }
          const change = Change.fromJSON(message.changeInfo)
          void changeManager?.submit(change, { submitToBackend: false })
        })
        socket.on('USER_LOCATION', (message: UserLocationMessage) => {
          const { channel, locations, userName, userSessionId } = message
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
        socket.on(
          'REQUEST_INFORMATION',
          (message: RequestUserInformationMessage) => {
            const { channel, reqType, userSessionId } = message
            if (channel === 'REQUEST_INFORMATION' && userSessionId !== token) {
              switch (reqType) {
                case 'CURRENT_LOCATION': {
                  session.broadcastLocations()
                  break
                }
              }
            }
          },
        )
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

          const response = yield apolloFetch(uri, { method: 'GET' })
          if (!response.ok) {
            const errorMessage = yield createFetchErrorMessage(
              response,
              'Error when fetching server LastChangeSequence',
            )
            throw new Error(errorMessage)
          }
          const changes = yield response.json()
          const sequence = changes.length > 0 ? changes[0].sequence : 0
          self.setLastChangeSequenceNumber(sequence)
        },
      ),
      getMissingChanges: flow(function* getMissingChanges() {
        const { session } = getRoot<ApolloRootModel>(self)
        const { changeManager } = (session as ApolloSessionModel)
          .apolloDataStore
        if (!self.lastChangeSequenceNumber) {
          throw new Error(
            'No LastChangeSequence stored in session. Please, refresh you browser to get last updates from server',
          )
        }
        const { baseURL, lastChangeSequenceNumber } = self

        const url = new URL('changes', baseURL)
        const searchParams = new URLSearchParams({
          since: String(lastChangeSequenceNumber),
          sort: '1',
        })
        url.search = searchParams.toString()
        const uri = url.toString()
        const apolloFetch = self.getFetcher({
          locationType: 'UriLocation',
          uri,
        })

        const response = yield apolloFetch(uri, { method: 'GET' })
        if (!response.ok) {
          console.error(
            `Error when fetching the last updates to recover socket connection — ${response.status}`,
          )
          return
        }
        const serializedChanges = yield response.json()
        for (const serializedChange of serializedChanges) {
          const change = Change.fromJSON(serializedChange)
          void changeManager?.submit(change, { submitToBackend: false })
        }
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
            throw new Error('ignore') // ignore message, will get caught by "catch"
          }
        } catch {
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
      return { postUserLocation: debouncePostUserLocation(postUserLocation) }
    })
    .actions(() => ({
      addMenuItems(role: Role) {
        if (
          !(role === 'admin' && isAbstractMenuManager(pluginManager.rootModel))
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
          !menuItems.some(
            (menuItem) =>
              'label' in menuItem && menuItem.label === 'Add Assembly',
          )
        ) {
          rootModel.insertInMenu(
            'Apollo',
            {
              label: 'Add Assembly',
              onClick: (session: ApolloSessionModel) => {
                ;(session as unknown as AbstractSessionModel).queueDialog(
                  (doneCallback) => [
                    AddAssembly,
                    {
                      session,
                      handleClose: () => {
                        doneCallback()
                      },
                      changeManager: session.apolloDataStore.changeManager,
                    },
                  ],
                )
              },
            },
            0,
          )
          rootModel.insertInMenu(
            'Apollo',
            {
              label: 'Delete Assembly',
              onClick: (session: ApolloSessionModel) => {
                ;(session as unknown as AbstractSessionModel).queueDialog(
                  (doneCallback) => [
                    DeleteAssembly,
                    {
                      session,
                      handleClose: () => {
                        doneCallback()
                      },
                      changeManager: session.apolloDataStore.changeManager,
                    },
                  ],
                )
              },
            },
            1,
          )
          rootModel.insertInMenu(
            'Apollo',
            {
              label: 'Import Features',
              onClick: (session: ApolloSessionModel) => {
                ;(session as unknown as AbstractSessionModel).queueDialog(
                  (doneCallback) => [
                    ImportFeatures,
                    {
                      session,
                      handleClose: () => {
                        doneCallback()
                      },
                      changeManager: (session as ApolloSessionModel)
                        .apolloDataStore.changeManager,
                    },
                  ],
                )
              },
            },
            2,
          )
          rootModel.insertInMenu(
            'Apollo',
            {
              label: 'Manage Users',
              onClick: (session: ApolloSessionModel) => {
                ;(session as unknown as AbstractSessionModel).queueDialog(
                  (doneCallback) => [
                    ManageUsers,
                    {
                      session,
                      handleClose: () => {
                        doneCallback()
                      },
                      changeManager: (session as ApolloSessionModel)
                        .apolloDataStore.changeManager,
                    },
                  ],
                )
              },
            },
            9,
          )
          rootModel.insertInMenu(
            'Apollo',
            {
              label: 'Undo',
              onClick: (session: ApolloSessionModel) => {
                const { apolloDataStore } = session
                const { notify } = session as unknown as AbstractSessionModel
                if (apolloDataStore.changeManager.recentChanges.length > 0) {
                  void apolloDataStore.changeManager.revertLastChange()
                } else {
                  notify('No changes to undo', 'info')
                }
              },
            },
            10,
          )
        }
      },
    }))
    .actions((self) => ({
      initialize: flow(function* initialize(role?: Role) {
        if (!role) {
          return
        }
        if (role === 'admin') {
          self.addMenuItems(role)
        }
        // Get and set server last change sequence into session storage
        yield self.updateLastChangeSequenceNumber()
        // Open socket listeners
        self.addSocketListeners()
        // request user locations
        const { baseURL } = self
        const uri = new URL('/users/locations', baseURL).href
        const apolloFetch = self.getFetcher({
          locationType: 'UriLocation',
          uri,
        })
        yield apolloFetch(uri, { method: 'GET' })
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
            const { session } = getRoot<ApolloRootModel>(self)
            session.broadcastLocations()
          }
        })
      }),
    }))
    .actions((self) => ({
      afterAttach() {
        autorun(
          async (reaction) => {
            if (inWebWorker) {
              return
            }
            try {
              const { authType, getRole } = self
              if (!authType) {
                return
              }
              const role = getRole()
              if (role) {
                await self.initialize(role)
              }
              reaction.dispose()
            } catch {
              // pass
            }
          },
          { name: 'ApolloInternetAccount' },
        )
      },
      initializeFromToken: flow(function* initializeFromToken(token: string) {
        const payload = getDecodedToken(token)
        yield self.initialize(payload.role)
      }),
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
            storeToken: flow(function* storeToken(token: string) {
              superStoreToken(token)
              yield self.initializeFromToken(token)
            }),
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
            storeToken: flow(function* storeToken(token: string) {
              superStoreToken(token)
              yield self.initializeFromToken(token)
            }),
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
            clientId: self.microsoftClientId,
          },
        }),
    }))
    .actions((self) => ({
      setAuthType(authType: AuthType) {
        self.authType = authType
      },
    }))
    .actions((self) => {
      const {
        getFetcher: superGetFetcher,
        getPreAuthorizationInformation: superGetPreAuthorizationInformation,
        retrieveToken: superRetrieveToken,
      } = self
      let authTypePromise: Promise<AuthType> | undefined
      return {
        async getPreAuthorizationInformation(location: UriLocation) {
          const preAuthInfo =
            await superGetPreAuthorizationInformation(location)
          return {
            ...preAuthInfo,
            authInfo: {
              ...preAuthInfo.authInfo,
              authType: await authTypePromise,
            },
          }
        },
        retrieveToken() {
          const {
            authType,
            googleAuthInternetAccount,
            microsoftAuthInternetAccount,
          } = self
          if (authType === 'google') {
            return googleAuthInternetAccount.retrieveToken()
          }
          if (authType === 'microsoft') {
            return microsoftAuthInternetAccount.retrieveToken()
          }
          if (authType === 'guest') {
            return superRetrieveToken()
          }
          throw new Error(`Unknown authType "${authType}"`)
        },
        getFetcher(
          location?: UriLocation,
        ): (input: RequestInfo, init?: RequestInit) => Promise<Response> {
          return async (
            input: RequestInfo,
            init?: RequestInit,
          ): Promise<Response> => {
            let { authType } = self
            const {
              googleAuthInternetAccount,
              googleClientId,
              microsoftAuthInternetAccount,
              microsoftClientId,
            } = self
            if (!authType) {
              if (!authTypePromise) {
                if (location?.internetAccountPreAuthorization) {
                  authTypePromise = Promise.resolve(
                    location.internetAccountPreAuthorization.authInfo.authType,
                  )
                } else if (googleAuthInternetAccount.retrieveToken()) {
                  authTypePromise = Promise.resolve('google')
                } else if (microsoftAuthInternetAccount.retrieveToken()) {
                  authTypePromise = Promise.resolve('microsoft')
                } else if (superRetrieveToken()) {
                  authTypePromise = Promise.resolve('guest')
                } else {
                  authTypePromise = new Promise((resolve, reject) => {
                    const { session } = getRoot<ApolloRootModel>(self)
                    const { allowGuestUser, baseURL, name } = self
                    ;(session as unknown as AbstractSessionModel).queueDialog(
                      (doneCallback: () => void) => [
                        AuthTypeSelector,
                        {
                          baseURL,
                          name,
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
                          google: Boolean(googleClientId),
                          microsoft: Boolean(microsoftClientId),
                          allowGuestUser,
                        },
                      ],
                    )
                  })
                }
              }
              authType = await authTypePromise
            }
            self.setAuthType(authType)
            let fetchToUse: (
              input: RequestInfo,
              init?: RequestInit,
            ) => Promise<Response>
            switch (authType) {
              case 'google': {
                fetchToUse = self.googleAuthInternetAccount.getFetcher(location)

                break
              }
              case 'microsoft': {
                fetchToUse =
                  self.microsoftAuthInternetAccount.getFetcher(location)

                break
              }
              case 'guest': {
                fetchToUse = superGetFetcher(location)

                break
              }
              default: {
                throw new Error(`Unknown authType "${authType}"`)
              }
            }
            const response = await fetchToUse(input, init)
            if (response.status === 401) {
              if (authType === 'google') {
                self.googleAuthInternetAccount.removeToken()
              } else if (authType === 'microsoft') {
                self.microsoftAuthInternetAccount.removeToken()
              } else {
                self.removeToken()
              }
            }
            return response
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
