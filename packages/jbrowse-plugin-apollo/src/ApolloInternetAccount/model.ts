/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { Change, type SerializedChange } from '@apollo-annotation/common'
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
import LockPersonIcon from '@mui/icons-material/LockPerson'
import LoginIcon from '@mui/icons-material/Login'
import { autorun } from 'mobx'
import { io } from 'socket.io-client'

import { version as pluginVersion } from '../../package.json'
import { addTopLevelAdminMenus } from '../menus/topLevelMenuAdmin'
import type { Collaborator } from '../session'
import type { ApolloRootModel } from '../types'
import { createFetchErrorMessage } from '../util'

import { AuthTypeSelector } from './components/AuthTypeSelector'
import { LoginInProgress } from './components/LoginInProgress'
import { NoAccess } from './components/NoAccess'
import type { ApolloInternetAccountConfigModel } from './configSchema'
import { LoginCancelledError, LoginFailedError } from './loginErrors'

interface AuthType {
  name: string
  needsPopup: boolean
}

type Role = 'admin' | 'user' | 'readOnly' | 'none'

const inWebWorker = typeof sessionStorage === 'undefined'

/**
 * The server explains why it refused a login in the "message" of its JSON
 * error body, so show that instead of the raw response
 */
async function getLoginErrorMessage(response: Response) {
  try {
    const { message } = (await response.clone().json()) as {
      message?: unknown
    }
    if (typeof message === 'string') {
      return message
    }
  } catch {
    // Not JSON, fall back to the raw response below
  }
  return createFetchErrorMessage(response, 'Error when logging in')
}

const stateModelFactory = (configSchema: ApolloInternetAccountConfigModel) => {
  return InternetAccount.named('ApolloInternetAccount')
    .props({
      type: types.literal('ApolloInternetAccount'),
      configuration: ConfigurationReference(configSchema),
    })
    .views((self) => ({
      get baseURL(): string {
        return getConf(self, 'baseURL')
      },
      /**
       * Set when the user asks to log in with a different account, so the next
       * login asks the identity provider to let them choose one
       */
      get selectAccountKey() {
        return `${self.internetAccountId}-selectAccount`
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
        if (self.role !== role) {
          self.role = role
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
            if (response.status === 403) {
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
              self.storeToken(token)
              resolve(token)
            },
            (error) => {
              self.removeToken()
              reject(
                error instanceof LoginCancelledError
                  ? error
                  : new LoginFailedError(error),
              )
            },
          )
        })
        return self.tokenPromise
      },
    }))
    .actions((self) => {
      let listener: (event: MessageEvent) => void
      let popupClosedPoll: ReturnType<typeof setInterval> | undefined
      let closeProgressDialog: (() => void) | undefined
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
          clearInterval(popupClosedPoll)
          popupClosedPoll = undefined
          closeProgressDialog?.()
          closeProgressDialog = undefined
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
          const error = urlParams.get('error')
          this.deleteMessageChannel()
          if (error) {
            reject(new Error(error))
            return
          }
          if (!token) {
            reject(new Error('Error with token endpoint'))
            return
          }
          self.storeToken(token)
          sessionStorage.removeItem(self.selectAccountKey)
          self.setRole()
          resolve(token)
        },
        /**
         * The login window can open behind the browser or get lost among other
         * windows, so show that a login is underway and let the user find or
         * abandon it
         */
        showLoginProgress(popup: Window, reject: (error: Error) => void) {
          const { session } = getRoot<ApolloRootModel>(self)
          ;(session as unknown as AbstractSessionModel).queueDialog(
            (doneCallback: () => void) => {
              closeProgressDialog = doneCallback
              return [
                LoginInProgress,
                {
                  name: self.name,
                  handleShowWindow: () => {
                    popup.focus()
                  },
                  handleCancel: () => {
                    this.deleteMessageChannel()
                    popup.close()
                    reject(new LoginCancelledError())
                  },
                },
              ]
            },
          )
        },
        /**
         * If the user closes the login window without logging in, nothing is
         * sent back, so treat it as them choosing not to log in
         */
        watchForPopupClosed(popup: Window, reject: (error: Error) => void) {
          popupClosedPoll = setInterval(() => {
            if (!popup.closed) {
              return
            }
            clearInterval(popupClosedPoll)
            const poll = popupClosedPoll
            // The login window closes itself right after sending the login
            // result, so give that message a moment to arrive
            setTimeout(() => {
              // A finished login clears the poll, and a new login replaces it
              if (popupClosedPoll === poll) {
                this.deleteMessageChannel()
                reject(new LoginCancelledError())
              }
            }, 1000)
          }, 500)
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
          if (sessionStorage.getItem(self.selectAccountKey)) {
            params.set('prompt', 'select_account')
          }
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
            const popup = window.open(url, eventName, 'width=500,height=600')
            if (!popup) {
              this.deleteMessageChannel()
              reject(
                new Error(
                  'The login window was blocked. Allow pop-ups for this site and try again.',
                ),
              )
              return
            }
            this.showLoginProgress(popup, reject)
            this.watchForPopupClosed(popup, reject)
          }
        },
      }
    })
    .actions((self) => ({
      async getTokenFromUser(
        resolve: (token: string) => void,
        reject: (error: Error) => void,
      ): Promise<void> {
        // JBrowse doesn't handle the promise this function returns, so errors
        // have to go to `reject` instead of being thrown
        try {
          const { baseURL } = self
          const authType = await new Promise(
            (resolve: (authType: AuthType) => void, reject) => {
              const { session } = getRoot<ApolloRootModel>(self)
              const { baseURL, name } = self
              ;(session as unknown as AbstractSessionModel).queueDialog(
                (doneCallback: () => void) => [
                  AuthTypeSelector,
                  {
                    name,
                    handleClose: (newAuthType?: AuthType | Error) => {
                      if (!newAuthType) {
                        reject(new LoginCancelledError())
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
          if (authType.needsPopup) {
            await self.openAuthWindow(authType.name, resolve, reject)
            return
          }
          const url = new URL('auth/login', baseURL)
          const searchParams = new URLSearchParams({ type: authType.name })
          url.search = searchParams.toString()
          const uri = url.toString()
          const response = await fetch(uri, { signal: self.controller.signal })
          if (!response.ok) {
            reject(new Error(await getLoginErrorMessage(response)))
            return
          }
          const { token } = await response.json()
          resolve(token)
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      },
    }))
    .volatile(() => ({
      loginMenuItemAdded: false,
    }))
    .actions((self) => ({
      setLoginMenuItemAdded() {
        self.loginMenuItemAdded = true
      },
    }))
    .actions((self) => {
      /**
       * Reopen the login dialog. A successful login reloads the page so that
       * the session loads this server's assemblies and tracks.
       */
      async function logIn() {
        try {
          await self.getToken()
        } catch (error) {
          if (error instanceof LoginCancelledError) {
            return
          }
          offerLogin(
            error instanceof Error ? error : new LoginFailedError(error),
          )
          return
        }
        globalThis.location.reload()
      }

      /**
       * Called when the user didn't log in, either because they dismissed the
       * login dialog or because logging in failed. Tells them what they are
       * missing and gives them ways to log in later.
       */
      function offerLogin(error?: Error) {
        const rootModel = getRoot<ApolloRootModel>(self)
        const { internetAccounts } = rootModel
        const session = rootModel.session as unknown as AbstractSessionModel
        const logInAction = {
          name: 'Log in',
          onClick: () => {
            void logIn()
          },
        }
        if (error === undefined) {
          session.notify(
            `Not logged in to ${self.name}. Apollo features are unavailable until you log in.`,
            'warning',
            logInAction,
          )
        } else {
          session.notifyError(
            `Could not log in to ${self.name}: ${error.message}`,
            error,
            undefined,
            logInAction,
          )
        }
        // JBrowse menu items can't be removed, but logging in reloads the
        // page, so this only needs adding once
        if (!self.loginMenuItemAdded && isAbstractMenuManager(rootModel)) {
          const apolloAccountCount = internetAccounts.filter(
            (ia) => ia.type === 'ApolloInternetAccount',
          ).length
          rootModel.appendToMenu('Apollo', {
            label: apolloAccountCount > 1 ? `Log in to ${self.name}` : 'Log in',
            icon: LoginIcon,
            onClick: () => {
              void logIn()
            },
          })
          self.setLoginMenuItemAdded()
        }
      }

      return { logIn, offerLogin }
    })
    .actions((self) => ({
      /**
       * Ask the server for a token with the user's current role, and reload
       * with it if an admin has given them access
       * @returns whether the user has access now
       */
      async checkAccess() {
        const token = self.retrieveToken()
        if (!token) {
          throw new Error('Not logged in')
        }
        const uri = new URL('auth/refresh', self.baseURL).href
        const response = await fetch(uri, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) {
          throw new Error(await createFetchErrorMessage(response))
        }
        const { token: newToken } = (await response.json()) as {
          token: string
        }
        const { role } = getDecodedToken(newToken)
        if (!role || role === 'none') {
          return false
        }
        self.storeToken(newToken)
        globalThis.location.reload()
        return true
      },
      switchAccount() {
        self.removeToken()
        sessionStorage.setItem(self.selectAccountKey, 'true')
        globalThis.location.reload()
      },
    }))
    .actions((self) => ({
      showNoAccess() {
        const token = self.retrieveToken()
        const { email = '', username = '' } = token
          ? getDecodedToken(token)
          : {}
        const { session } = getRoot<ApolloRootModel>(self)
        ;(session as unknown as AbstractSessionModel).queueDialog(
          (doneCallback: () => void) => [
            NoAccess,
            {
              name: self.name,
              username,
              email,
              handleCheckAgain: self.checkAccess,
              handleSwitchAccount: () => {
                doneCallback()
                self.switchAccount()
              },
              handleClose: doneCallback,
            },
          ],
        )
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
        const { session } = getRoot<ApolloRootModel>(self)
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

        let serializedChanges: SerializedChange[]
        try {
          const response: Response = yield apolloFetch(uri, {
            method: 'GET',
            signal: self.controller.signal,
          })
          if (!response.ok) {
            console.error(
              `Error when fetching the last updates to recover socket connection — ${response.status}`,
            )
            return
          }
          ;({ changes: serializedChanges } = yield response.json())
        } catch (error) {
          // Reading the body can also be aborted, so it's inside the try too
          if (!self.controller.signal.aborted) {
            console.error(error)
          }
          return
        }
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
    .actions((self) => ({
      addSocketListeners() {
        const { session } = getRoot<ApolloRootModel>(self)
        const { notify } = session as unknown as AbstractSessionModel
        const token = self.retrieveToken()
        if (!token) {
          throw new Error('No Token found')
        }
        const user = getDecodedToken(token)
        const localSessionId = makeUserSessionId(user)
        const { socket } = self
        const { addCheckResult, changeManager, deleteCheckResult } =
          session.apolloDataStore
        socket.on('connect', () => {
          // No baseline yet, so there is nothing to be missing: this is the
          // first connect, and loadInitialState() is still fetching the
          // sequence number getMissingChanges() needs. That call would throw
          // without one, and as a `void` it would throw into nothing.
          //
          // These handlers used to be registered after that request rather
          // than before it, which is why the case is new: the first connect
          // arrived while nothing was listening for it.
          if (!self.lastChangeSequenceNumber) {
            return
          }
          void self.getMissingChanges()
        })
        socket.on('connect_error', (error) => {
          console.error(error)
          notify('Could not connect to the Apollo server.', 'error')
        })
        socket.on('COMMON', (message: ChangeMessage | CheckResultUpdate) => {
          if ('checkResult' in message) {
            if (message.deleted) {
              deleteCheckResult(message.checkResult._id)
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
          const { channel, locations, userName, userSessionId } = message
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
            const { channel, userSessionId } = message
            if (channel === 'REQUEST_INFORMATION' && userSessionId !== token) {
              session.broadcastLocations()
            }
          },
        )
      },
    }))
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
    .actions((self) => {
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
          const { session } = getRoot<ApolloRootModel>(self)
          session.broadcastLocations()
        }
      }
      return {
        /**
         * The half of startup that must happen exactly once. None of it is a
         * request, so nothing here is worth retrying — and all of it registers
         * something that has no idea it has been registered before. A menu
         * contribution is appended to a log the root model replays on every
         * open, and each socket handler is a fresh arrow function socket.io
         * cannot recognize as a repeat, so a second run means a second "Admin"
         * submenu and every COMMON message submitted to the change manager
         * twice. (The two addEventListener calls are the exception, and only by
         * luck: the handler references are stable, so the browser de-duplicates
         * them for us.)
         *
         * `addSocketListeners()` goes first because it is the only step that
         * can throw — 'No Token found', before it has registered anything — so
         * a failed run leaves nothing installed and the caller can simply try
         * again. That ordering is what lets `afterAttach` enforce "at most
         * once" without a flag.
         */
        install(role: Role) {
          if (role === 'none') {
            self.showNoAccess()
            const rootModel = getRoot(self)
            if (isAbstractMenuManager(rootModel)) {
              rootModel.appendToMenu('Apollo', {
                label: 'Check access',
                icon: LockPersonIcon,
                onClick: () => {
                  self.showNoAccess()
                },
              })
            }
            return
          }
          self.addSocketListeners()
          const rootModel = getRoot(self)
          if (role === 'admin' && isAbstractMenuManager(rootModel)) {
            addTopLevelAdminMenus(rootModel)
          }
          window.addEventListener('beforeunload', beforeUnloadListener)
          document.addEventListener(
            'visibilitychange',
            visibilityChangeListener,
          )
        },
        /**
         * The other half: everything that talks to the server, and so is
         * expected to fail and be retried. It leaves nothing behind, so running
         * it again costs a request and nothing else.
         */
        loadInitialState: flow(function* loadInitialState() {
          // Get and set server last change sequence into session storage
          yield self.updateLastChangeSequenceNumber()
          // request user locations
          const { baseURL } = self
          const uri = new URL('users/locations', baseURL).href
          const apolloFetch = self.getFetcher({
            locationType: 'UriLocation',
            uri,
          })
          yield apolloFetch(uri, {
            method: 'GET',
            signal: self.controller.signal,
          })
        }),
        /**
         * Warns the user if this plugin and the server it talks to are not the
         * same version, since mismatched changes or endpoints can corrupt data
         * or fail in confusing ways. Doesn't need a token, so it runs as soon as
         * there's a session to show the warning in.
         */
        checkServerVersion: flow(function* checkServerVersion() {
          const uri = new URL('health/version', self.baseURL).href
          let serverVersion: string | undefined
          try {
            const response: Response = yield fetch(uri, {
              signal: self.controller.signal,
            })
            if (response.ok) {
              ;({ version: serverVersion } = yield response.json())
            } else if (response.status !== 404) {
              // 404 means a server from before this endpoint existed, which is
              // a mismatch; anything else says nothing about the version
              console.error(
                yield createFetchErrorMessage(
                  response,
                  'Error when checking Apollo server version',
                ),
              )
              return
            }
          } catch (error) {
            if (!self.controller.signal.aborted) {
              console.error(error)
            }
            return
          }
          if (serverVersion === pluginVersion || !isAlive(self)) {
            return
          }
          const { session } = getRoot<ApolloRootModel>(self)
          ;(session as unknown as AbstractSessionModel).notify(
            `The Apollo server at ${self.baseURL} is ${
              serverVersion ? `version ${serverVersion}` : 'an older version'
            }, but this Apollo plugin is version ${pluginVersion}. Apollo may not work correctly until they match. Ask your administrator to update ${
              serverVersion ? 'one of them' : 'the server'
            }.`,
            'error',
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
          (reaction) => {
            if (inWebWorker) {
              return
            }
            const { session } = getRoot<ApolloRootModel>(self)
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!session) {
              return
            }
            reaction.dispose()
            void self.checkServerVersion()
          },
          { name: 'ApolloInternetAccountVersionCheck' },
        )

        // Two reactions rather than one, because the two halves of startup want
        // opposite things: install() must run at most once and loadInitialState()
        // must be free to run again.
        //
        // They were one, and it could not give both. Its dispose() sat behind
        // both awaits, so the reaction stayed armed across two round trips
        // while everything install() does had already been done — and what it
        // tracks is `self.role`, which those very requests write: a 403 from
        // either sends getFetcher through removeToken()/setRole(), clearing the
        // role and then setting it again once a new token arrives. So an
        // expired token at startup, the ordinary case, installed everything a
        // second time.
        //
        // This one is synchronous, and that is what makes "at most once"
        // structural rather than a flag: dispose() runs in the same tick as
        // install(), so there is no window for anything to invalidate it.
        autorun(
          (reaction) => {
            if (inWebWorker) {
              return
            }
            const { session } = getRoot<ApolloRootModel>(self)
            // This can be undefined if there is no session loaded, e.g. on
            // the start screen
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!session || !self.role) {
              return
            }
            try {
              self.install(self.role)
            } catch {
              // addSocketListeners threw before registering anything, so stay
              // armed and install nothing until there is a token
              return
            }
            reaction.dispose()
          },
          { name: 'ApolloInternetAccountInstall' },
        )

        autorun(
          async (reaction) => {
            if (inWebWorker) {
              return
            }
            const { session } = getRoot<ApolloRootModel>(self)
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!session || !self.role) {
              return
            }
            if (self.role === 'none') {
              // nothing to load for a user with no access
              reaction.dispose()
              return
            }
            try {
              await self.loadInitialState()
              reaction.dispose()
            } catch {
              // if it fails, do nothing so the autorun runs again
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
