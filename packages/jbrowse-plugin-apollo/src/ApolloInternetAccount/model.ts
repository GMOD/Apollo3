/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { Change } from '@apollo-annotation/common'
import {
  type ChangeMessage,
  type CheckResultUpdate,
  type RequestUserInformationMessage,
  type UserLocation,
  type UserLocationMessage,
  getDecodedToken,
  makeUserSessionId,
} from '@apollo-annotation/shared'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes'
import {
  type AbstractSessionModel,
  type UriLocation,
  isAbstractMenuManager,
  isElectron,
} from '@jbrowse/core/util'
import {
  type Instance,
  flow,
  getRoot,
  isAlive,
  types,
} from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'
import { io } from 'socket.io-client'

import { addTopLevelAdminMenus } from '../menus/topLevelMenuAdmin'
import type { Collaborator } from '../session'
import { isApolloInternetAccount, type ApolloRootModel } from '../types'
import { createFetchErrorMessage } from '../util'

import { AuthTypeSelector } from './components/AuthTypeSelector'
import type { ApolloInternetAccountConfigModel } from './configSchema'
import { revokeOtherApolloTokens } from './tokenUtils'

type AuthType = 'google' | 'microsoft' | 'logingov' | 'guest'
interface LocalAuthSelection {
  type: 'local'
  identifier: string
  password: string
}
type AuthSelection = AuthType | LocalAuthSelection

interface LiveApolloSession extends AbstractSessionModel {
  notify(message: string, level?: string): void
  broadcastLocations(): void
  addOrUpdateCollaborator(collaborator: Collaborator): void
  apolloDataStore: {
    addCheckResult(checkResult: unknown): void
    deleteCheckResult(id: string): void
    changeManager: {
      submit(change: Change, options?: { submitToBackend?: boolean }): unknown
    }
  }
}

type Role = 'admin' | 'user' | 'readOnly' | 'none'

function isGuestIdentity(decodedToken: { username?: string; email?: string }) {
  const normalizedUsername = String(decodedToken.username).toLowerCase()
  const normalizedEmail = String(decodedToken.email).toLowerCase()
  return normalizedUsername === 'guest' || normalizedEmail === 'guest_user'
}

const inWebWorker = typeof sessionStorage === 'undefined'

const stateModelFactory = (configSchema: ApolloInternetAccountConfigModel) => {
  return InternetAccount.named('ApolloInternetAccount')
    .props({
      type: types.literal('ApolloInternetAccount'),
      configuration: ConfigurationReference(configSchema),
    })
    .views((self) => ({
      get baseURL(): string {
        const configuredBaseURL = String(getConf(self, 'baseURL') ?? '')
        if (!configuredBaseURL) {
          return globalThis.location?.origin || 'http://localhost'
        }
        try {
          const fallbackBase = globalThis.location?.origin || 'http://localhost'
          const resolved = new URL(configuredBaseURL, fallbackBase).href
          return resolved.endsWith('/') ? resolved : `${resolved}/`
        } catch {
          return configuredBaseURL
        }
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
    .volatile(() => ({
      role: undefined as Role | undefined,
      controller: new AbortController(),
      tokenPromise: undefined as Promise<string> | undefined,
    }))
    .actions((self) => ({
      setRole() {
        const token = self.retrieveToken()
        if (!token) {
          self.role = undefined
          return
        }
        const dec = getDecodedToken(token)
        const { role, exp } = dec
        if (exp < Date.now() / 1000) {
          self.role = undefined
          self.removeToken()
          return
        }
        const normalizedRole: Role = isGuestIdentity(dec)
          ? 'readOnly'
          : role ?? 'none'
        if (self.role !== normalizedRole) {
          self.role = normalizedRole
        }
      },
    }))
    .actions((self) => {
      const superGetFetcher = self.getFetcher
      return {
        getFetcher(loc?: UriLocation) {
          const fetcher = superGetFetcher(loc)
          return async (input: RequestInfo, init?: RequestInit) => {
            const response = await fetcher(input, init)
            // Only invalidate local token on explicit auth failure.
            if (response.status === 401) {
              self.removeToken()
              self.setRole()
              return fetcher(input, init)
            }
            return response
          }
        },
      }
    })
    .actions((self) => ({
      removeToken() {
        sessionStorage.removeItem(self.tokenKey)
        self.tokenPromise = undefined
      },
      removeOtherApolloTokens() {
        let rootModel: ApolloRootModel
        try {
          rootModel = getRoot<ApolloRootModel>(self)
        } catch {
          return
        }
        const apolloAccounts = rootModel.internetAccounts.filter((account) =>
          isApolloInternetAccount(account),
        )
        revokeOtherApolloTokens(apolloAccounts, self.tokenKey)
      },
      applyLoggedInToken(token: string) {
        this.removeOtherApolloTokens()
        self.storeToken(token)
        self.setRole()
      },
    }))
    .actions((self) => ({
      async getToken(location?: UriLocation): Promise<string> {
        if (self.tokenPromise) {
          return self.tokenPromise
        }
        let token = location?.internetAccountPreAuthorization?.authInfo?.token
        if (token) {
          self.tokenPromise = Promise.resolve(token)
          return self.tokenPromise
        }
        if (inWebWorker) {
          throw new Error(
            'Did not get internet account pre-authorization info in worker',
          )
        }
        token = self.retrieveToken()
        if (token) {
          self.tokenPromise = Promise.resolve(token)
          return self.tokenPromise
        }
        self.tokenPromise = new Promise((resolve, reject) => {
          self.getTokenFromUser(
            (token) => {
              self.applyLoggedInToken(token)
              resolve(token)
            },
            (error) => {
              self.removeToken()
              reject(error)
            },
          )
        })
        return self.tokenPromise
      },
    }))
    .actions((self) => {
      let listener: (event: MessageEvent) => void
      return {
        addMessageChannel(
          resolve: (token: string) => void,
          reject: (error: Error) => void,
        ) {
          listener = (event) => {
            this.finishOAuthWindow(event, resolve, reject)
          }
          window.addEventListener('message', listener)
        },
        deleteMessageChannel() {
          window.removeEventListener('message', listener)
        },
        finishOAuthWindow(
          event: MessageEvent,
          resolve: (token: string) => void,
          reject: (error: Error) => void,
        ) {
          if (
            event.data.name !== `JBrowseAuthWindow-${self.internetAccountId}`
          ) {
            return
          }
          const redirectUriWithInfo = event.data.redirectUri
          const fixedQueryString = redirectUriWithInfo.replace('#', '?')
          const redirectUrl = new URL(fixedQueryString)
          const queryStringSearch = redirectUrl.search
          const urlParams = new URLSearchParams(queryStringSearch)
          const token = urlParams.get('access_token')
          this.deleteMessageChannel()
          if (!token) {
            reject(new Error('Error with token endpoint'))
            return
          }
          self.applyLoggedInToken(token)
          resolve(token)
        },
        async openAuthWindow(
          type: string,
          resolve: (token: string) => void,
          reject: (error: Error) => void,
        ) {
          const redirectUri = isElectron
            ? 'http://localhost/auth'
            : globalThis.location.origin + globalThis.location.pathname
          const url = new URL('auth/login', self.baseURL)
          const params = new URLSearchParams({
            type,
            redirect_uri: redirectUri,
          })
          url.search = params.toString()
          const eventName = `JBrowseAuthWindow-${self.internetAccountId}`
          if (isElectron) {
            const { ipcRenderer } = globalThis.require('electron')
            const redirectUriFromElectron = await ipcRenderer.invoke(
              'openAuthWindow',
              {
                internetAccountId: self.internetAccountId,
                data: { redirect_uri: redirectUri },
                url: url.toString(),
              },
            )
            const eventFromDesktop = new MessageEvent('message', {
              data: { name: eventName, redirectUri: redirectUriFromElectron },
            })
            this.finishOAuthWindow(eventFromDesktop, resolve, reject)
          } else {
            this.addMessageChannel(resolve, reject)
            window.open(url, eventName, 'width=500,height=600')
          }
        },
      }
    })
    .actions((self) => ({
      async getTokenFromUserWithPreference(
        resolve: (token: string) => void,
        reject: (error: Error) => void,
        preferGuest: boolean,
      ): Promise<void> {
        const { baseURL } = self
        const authType = await new Promise(
          (resolve: (authType: AuthSelection) => void, reject) => {
            if (!isAlive(self)) {
              reject(new Error('Apollo session is no longer available'))
              return
            }
            let session: ApolloRootModel['session'] | undefined
            try {
              session = getRoot<ApolloRootModel>(self).session
            } catch {
              reject(new Error('No active session available for login dialog'))
              return
            }
            if (!session || !isAlive(session)) {
              reject(new Error('No active session available for login dialog'))
              return
            }
            const { baseURL, name } = self
            ;(session as unknown as AbstractSessionModel).queueDialog(
              (doneCallback: () => void) => [
                AuthTypeSelector,
                {
                  name,
                  preferGuest,
                  handleClose: (newAuthType?: AuthSelection | Error) => {
                    if (!newAuthType) {
                      reject(new Error('user cancelled entry'))
                    } else if (newAuthType instanceof Error) {
                      reject(newAuthType)
                    } else {
                      resolve(newAuthType)
                    }
                    doneCallback()
                  },
                  baseURL,
                },
              ],
            )
          },
        )
        if (typeof authType !== 'string' && authType.type === 'local') {
          const uri = new URL('auth/local', baseURL).href
          const response = await fetch(uri, {
            method: 'POST',
            signal: self.controller.signal,
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              identifier: authType.identifier,
              password: authType.password,
            }),
          })
          if (!response.ok) {
            const errorMessage = await createFetchErrorMessage(
              response,
              'Error when logging in locally',
            )
            reject(new Error(errorMessage))
            return
          }
          const { token } = await response.json()
          resolve(token)
          return
        }
        if (typeof authType === 'string' && authType !== 'guest') {
          void self.openAuthWindow(authType, resolve, reject)
          return
        }
        const url = new URL('auth/login', baseURL)
        const searchParams = new URLSearchParams({ type: 'guest' })
        url.search = searchParams.toString()
        const uri = url.toString()
        const response = await fetch(uri, { signal: self.controller.signal })
        if (!response.ok) {
          const errorMessage = await createFetchErrorMessage(
            response,
            'Error when logging in',
          )
          reject(new Error(errorMessage))
          return
        }
        const { token } = await response.json()
        resolve(token)
      },
      async getTokenFromUser(
        resolve: (token: string) => void,
        reject: (error: Error) => void,
      ): Promise<void> {
        return this.getTokenFromUserWithPreference(resolve, reject, true)
      },
      async loginWithPrompt(): Promise<string> {
        const token = await new Promise<string>((resolve, reject) => {
          this.getTokenFromUserWithPreference(
            (newToken: string) => {
              self.applyLoggedInToken(newToken)
              resolve(newToken)
            },
            (error: Error) => {
              reject(error)
            },
            false,
          )
        })
        return token
      },
    }))
    .volatile(() => ({
      lastChangeSequenceNumber: undefined as number | undefined,
    }))
    .actions((self) => ({
      setLastChangeSequenceNumber(sequenceNumber: number) {
        self.lastChangeSequenceNumber = sequenceNumber
      },
    }))
    .actions((self) => ({
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

          let response: Response
          try {
            response = yield apolloFetch(uri, {
              method: 'GET',
              signal: self.controller.signal,
            })
          } catch (error) {
            if (!self.controller.signal.aborted) {
              console.error(error)
            }
            return
          }
          if (!response.ok) {
            const errorMessage = yield createFetchErrorMessage(
              response,
              'Error when fetching server LastChangeSequence',
            )
            throw new Error(errorMessage)
          }
          const { changes } = yield response.json()
          const sequence = changes.length > 0 ? changes[0].sequence : 0
          self.setLastChangeSequenceNumber(sequence)
        },
      ),
      getMissingChanges: flow(function* getMissingChanges() {
        if (!isAlive(self)) {
          return
        }
        let session: ApolloRootModel['session'] | undefined
        try {
          session = getRoot<ApolloRootModel>(self).session
        } catch {
          return
        }
        if (!session || !isAlive(session)) {
          return
        }
        const { changeManager } = session.apolloDataStore
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

        let response: Response
        try {
          response = yield apolloFetch(uri, {
            method: 'GET',
            signal: self.controller.signal,
          })
        } catch (error) {
          if (!self.controller.signal.aborted) {
            console.error(error)
          }
          return
        }
        if (!response.ok) {
          console.error(
            `Error when fetching the last updates to recover socket connection — ${response.status}`,
          )
          return
        }
        const { changes: serializedChanges } = yield response.json()
        for (const serializedChange of serializedChanges) {
          const change = Change.fromJSON(serializedChange)
          void changeManager.submit(change, { submitToBackend: false })
        }
      }),
    }))
    .volatile((self) => {
      const { origin, pathname: path } = new URL('socket.io/', self.baseURL)
      return { socket: io(origin, { path }) }
    })
    .actions((self) => {
      function getLiveSession() {
        if (!isAlive(self)) {
          return undefined
        }
        try {
          const { session } = getRoot<ApolloRootModel>(self)
          return session && isAlive(session)
            ? (session as unknown as LiveApolloSession)
            : undefined
        } catch {
          return undefined
        }
      }

      return {
        addSocketListeners() {
          const token = self.retrieveToken()
          if (!token) {
            throw new Error('No Token found')
          }
          const user = getDecodedToken(token)
          const localSessionId = makeUserSessionId(user)
          const { socket } = self
          socket.on('connect', () => {
            void self.getMissingChanges()
          })
          socket.on('connect_error', (error) => {
            console.error(error)
            getLiveSession()?.notify(
              'Could not connect to the Apollo server.',
              'error',
            )
          })
          socket.on('COMMON', (message: ChangeMessage | CheckResultUpdate) => {
            const session = getLiveSession()
            if (!session) {
              return
            }
            const { addCheckResult, changeManager, deleteCheckResult } =
              session.apolloDataStore
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
            if (message.userSessionId === localSessionId) {
              return // we did this change, no need to apply it again
            }
            const change = Change.fromJSON(message.changeInfo)
            void changeManager.submit(change, { submitToBackend: false })
          })
          socket.on('USER_LOCATION', (message: UserLocationMessage) => {
            const session = getLiveSession()
            if (!session) {
              return
            }
            const { channel, locations, userName, userSessionId } = message
            if (
              channel === 'USER_LOCATION' &&
              userSessionId !== localSessionId
            ) {
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
              const session = getLiveSession()
              if (!session) {
                return
              }
              const { channel, userSessionId } = message
              if (
                channel === 'REQUEST_INFORMATION' &&
                userSessionId !== token
              ) {
                session.broadcastLocations()
              }
            },
          )
        },
      }
    })
    .actions((self) => {
      async function postUserLocation(userLoc: UserLocation[]) {
        if (!isAlive(self) || self.role === 'none') {
          return
        }
        const { baseURL, controller } = self
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
            signal: controller.signal,
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
          timeoutId = setTimeout(() => {
            fn(userLocation)
          }, debounceTimeout)
        }
      }
      return { postUserLocation: debouncePostUserLocation(postUserLocation) }
    })
    .volatile(() => ({ roleNotificationSent: false }))
    .actions((self) => {
      function getLiveSession() {
        if (!isAlive(self)) {
          return undefined
        }
        try {
          const { session } = getRoot<ApolloRootModel>(self)
          return session && isAlive(session)
            ? (session as unknown as LiveApolloSession)
            : undefined
        } catch {
          return undefined
        }
      }

      function beforeUnloadListener() {
        self.postUserLocation([])
      }
      function visibilityChangeListener() {
        // fires when user switches tabs, apps, goes to homescreen, etc.
        if (document.visibilityState === 'hidden') {
          self.postUserLocation([])
        }
        // fires when app transitions from prerender, user returns to the app / tab.
        if (document.visibilityState === 'visible') {
          getLiveSession()?.broadcastLocations()
        }
      }
      return {
        initialize: flow(function* initialize(role: Role) {
          if (!isAlive(self)) {
            return
          }
          if (role === 'none') {
            if (!self.roleNotificationSent) {
              getLiveSession()?.notify(
                'You have registered as an Apollo user but have not been given access. Ask your administrator to enable access for your account.',
                'warning',
              )
              self.roleNotificationSent = true
            }
            return
          }
          if (role === 'admin') {
            if (!isAlive(self)) {
              return
            }
            let rootModel: unknown
            try {
              rootModel = getRoot(self)
            } catch {
              return
            }
            if (isAbstractMenuManager(rootModel)) {
              addTopLevelAdminMenus(rootModel)
            }
          }
          // Get and set server last change sequence into session storage
          yield self.updateLastChangeSequenceNumber()
          // Open socket listeners
          self.addSocketListeners()
          // request user locations
          const { baseURL } = self
          const uri = new URL('users/locations', baseURL).href
          const apolloFetch = self.getFetcher({
            locationType: 'UriLocation',
            uri,
          })
          try {
            yield apolloFetch(uri, {
              method: 'GET',
              signal: self.controller.signal,
            })
          } catch {
            if (!self.controller.signal.aborted) {
              console.error('Fetching user locations failed')
            }
          }
          window.addEventListener('beforeunload', beforeUnloadListener)
          document.addEventListener(
            'visibilitychange',
            visibilityChangeListener,
          )
        }),
        removeBeforeUnloadListener() {
          window.removeEventListener('beforeunload', beforeUnloadListener)
        },
        removeVisibilityChangeListener() {
          document.removeEventListener(
            'visibilitychange',
            visibilityChangeListener,
          )
        },
      }
    })
    .actions((self) => ({
      afterAttach() {
        self.setRole()
        autorun(
          async (reaction) => {
            if (inWebWorker) {
              return
            }
            if (!isAlive(self)) {
              return
            }
            if (self.role) {
              try {
                await self.initialize(self.role)
                reaction.dispose()
              } catch {
                // if initialize fails, do nothing so the autorun runs again
              }
            }
          },
          { name: 'ApolloInternetAccount' },
        )
      },
      beforeDestroy() {
        self.removeBeforeUnloadListener()
        self.removeVisibilityChangeListener()
        self.controller.abort(
          new DOMException('Cleaning up Apollo connection', 'AbortError'),
        )
        self.socket.close()
      },
    }))
}

export default stateModelFactory
export type ApolloInternetAccountStateModel = ReturnType<
  typeof stateModelFactory
>
// eslint disable because of
// https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ApolloInternetAccountModel
  extends Instance<ApolloInternetAccountStateModel> {}
