import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import { UriLocation } from '@jbrowse/core/util/types'
import { Instance, getParent, types } from 'mobx-state-tree'

import { ApolloLoginForm } from './components/ApolloLoginForm'
import { ApolloInternetAccountConfigModel } from './configSchema'

const inWebWorker = typeof sessionStorage === 'undefined'

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
      get authHeader(): string {
        return getConf(self, 'authHeader') || 'Authorization'
      },
      get tokenType(): string {
        return getConf(self, 'tokenType') || 'Bearer'
      },
      get internetAccountType() {
        return 'ApolloInternetAccount'
      },
      get authenticationURL(): string {
        return getConf(self, 'authenticationURL')
      },
      handlesLocation(location: UriLocation): boolean {
        const validDomains = self.accountConfig.domains || []
        return validDomains.some((domain: string) =>
          location?.uri.includes(domain),
        )
      },
      generateAuthInfo() {
        return {
          internetAccountType: this.internetAccountType,
          authInfo: {
            authHeader: this.authHeader,
            tokenType: this.tokenType,
            configuration: self.accountConfig,
          },
        }
      },
    }))
    .actions((self) => {
      let resolve: (token: string) => void = () => undefined
      let reject: () => void = () => undefined
      let openLocationPromise: Promise<string> | undefined = undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let preAuthInfo: any = {}
      return {
        setTokenInfo(token: string) {
          sessionStorage.setItem(`${self.internetAccountId}-token`, token)
        },
        handleClose(token?: string) {
          if (token) {
            if (!inWebWorker) {
              this.setTokenInfo(token)
            }
            resolve(token)
          } else {
            reject()
          }
          resolve = () => undefined
          reject = () => undefined
          openLocationPromise = undefined
        },
        async checkToken() {
          let token =
            preAuthInfo?.authInfo?.token ||
            (!inWebWorker
              ? sessionStorage.getItem(`${self.internetAccountId}-token`)
              : null)
          if (!token) {
            if (!openLocationPromise) {
              openLocationPromise = new Promise(async (r, x) => {
                const { session } = getParent(self, 2)

                session.queueDialog((doneCallback: () => void) => [
                  ApolloLoginForm,
                  {
                    authenticationURL: self.authenticationURL,
                    internetAccountId: self.internetAccountId,
                    handleClose: (closeToken: string) => {
                      this.handleClose(closeToken)
                      doneCallback()
                    },
                  },
                ])
                resolve = r
                reject = x
              })
            }
            token = await openLocationPromise
          }

          return token
        },
        openLocation(location: UriLocation) {
          return this.checkToken()
        },
        getSessionAccountKey() {
          return `${self.internetAccountId}-token`
        },
        handleError() {
          if (!inWebWorker) {
            preAuthInfo = self.generateAuthInfo()
            sessionStorage.removeItem(`${self.internetAccountId}-token`)
          }
          throw new Error('Could not access resource with token')
        },
      }
    })
}

export default stateModelFactory
export type ApolloStateModel = ReturnType<typeof stateModelFactory>
export type ApolloModel = Instance<ApolloStateModel>
