import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes'
import {
  AbstractSessionModel,
  isAbstractMenuManager,
  isElectron,
} from '@jbrowse/core/util'
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

import { ApolloSessionModel, Collaborator } from '../session'
import { ApolloRootModel } from '../types'
import { createFetchErrorMessage } from '../util'
import { addMenuItems } from './addMenuItems'
import { AuthTypeSelector } from './components/AuthTypeSelector'
import { ApolloInternetAccountConfigModel } from './configSchema'

type AuthType = 'google' | 'microsoft' | 'guest'

type Role = 'admin' | 'user' | 'readOnly'

const inWebWorker = typeof sessionStorage === 'undefined'

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
    }))
    .actions((self) => {
      let roleNotificationSent = false
      return {
        setRole() {
          const token = self.retrieveToken()
          if (!token) {
            self.role = undefined
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
          if (self.role !== role) {
            self.role = role
          }
        },
      }
    })
    .actions((self) => {
      let listener: (event: MessageEvent) => void
      return {
        addMessageChannel(
          resolve: (token: string) => void,
          reject: (error: Error) => void,
        ) {
          listener = (event) => {
            // this should probably get better handling, but ignored for now
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.finishOAuthWindow(event, resolve, reject)
          }
          window.addEventListener('message', listener)
        },
        deleteMessageChannel() {
          window.removeEventListener('message', listener)
        },
        async finishOAuthWindow(
          event: MessageEvent,
          resolve: (token: string) => void,
          reject: (error: Error) => void,
        ) {
          if (
            event.data.name !== `JBrowseAuthWindow-${self.internetAccountId}`
          ) {
            return this.deleteMessageChannel()
          }
          const redirectUriWithInfo = event.data.redirectUri
          const fixedQueryString = redirectUriWithInfo.replace('#', '?')
          const redirectUrl = new URL(fixedQueryString)
          const queryStringSearch = redirectUrl.search
          const urlParams = new URLSearchParams(queryStringSearch)
          const token = urlParams.get('access_token')
          this.deleteMessageChannel()
          if (!token) {
            return reject(new Error('Error with token endpoint'))
          }
          self.storeToken(token)
          self.setRole()
          return resolve(token)
        },
        async openAuthWindow(
          type: string,
          resolve: (token: string) => void,
          reject: (error: Error) => void,
        ) {
          const redirectUri = isElectron
            ? 'http://localhost/auth'
            : window.location.origin + window.location.pathname
          const url = new URL('auth/login', self.baseURL)
          const params = new URLSearchParams({
            type,
            redirect_uri: redirectUri,
          })
          url.search = params.toString()
          const eventName = `JBrowseAuthWindow-${self.internetAccountId}`
          if (isElectron) {
            const { ipcRenderer } = window.require('electron')
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
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.finishOAuthWindow(eventFromDesktop, resolve, reject)
          } else {
            this.addMessageChannel(resolve, reject)
            window.open(url, eventName, 'width=500,height=600')
          }
        },
      }
    })
    .actions((self) => ({
      async getTokenFromUser(
        resolve: (token: string) => void,
        reject: (error: Error) => void,
      ): Promise<void> {
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
        if (authType !== 'guest') {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          self.openAuthWindow(authType, resolve, reject)
          return
        }
        const url = new URL('auth/login', baseURL)
        const searchParams = new URLSearchParams({ type: authType })
        url.search = searchParams.toString()
        const uri = url.toString()
        const response = await fetch(uri)
        if (!response.ok) {
          const errorMessage = await createFetchErrorMessage(
            response,
            'Error when logging in',
          )
          return reject(new Error(errorMessage))
        }
        const { token } = await response.json()
        resolve(token)
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
    .volatile((self) => ({
      socket: io(self.baseURL),
    }))
    .actions((self) => ({
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
          await self.getMissingChanges()
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
    .actions((self) => ({
      initialize: flow(function* initialize(role: Role) {
        if (role === 'admin') {
          const rootModel = getRoot(self)
          if (isAbstractMenuManager(rootModel)) {
            addMenuItems(rootModel)
          }
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
        self.setRole()
        autorun(
          async (reaction) => {
            if (inWebWorker) {
              return
            }
            if (self.role) {
              await self.initialize(self.role)
              reaction.dispose()
            }
          },
          { name: 'ApolloInternetAccount' },
        )
      },
    }))
}

export default stateModelFactory
export type ApolloInternetAccountStateModel = ReturnType<
  typeof stateModelFactory
>
export type ApolloInternetAccountModel =
  Instance<ApolloInternetAccountStateModel>
