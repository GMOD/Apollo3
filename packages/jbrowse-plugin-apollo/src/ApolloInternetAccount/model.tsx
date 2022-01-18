import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import { RemoteFileWithRangeCache } from '@jbrowse/core/util/io'
import { UriLocation } from '@jbrowse/core/util/types'
import { getParent } from 'mobx-state-tree'
import { ApolloInternetAccountConfigModel } from './configSchema'
import { Instance, types } from 'mobx-state-tree'
import React, { useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  TextField,
} from '@material-ui/core'

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
    .views(self => ({
      get authHeader(): string {
        return getConf(self, 'authHeader') || 'Authorization'
      },
      get tokenType(): string {
        return getConf(self, 'tokenType') || 'Bearer'
      },
      get internetAccountType() {
        return 'ApolloInternetAccount'
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
    .actions(self => {
      let resolve: Function = () => {}
      let reject: Function = () => {}
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

          resolve = () => {}
          reject = () => {}
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

                console.log('about to queue')
                session.queueDialog((doneCallback: Function) => [
                  ApolloLoginForm,
                  {
                    internetAccountId: self.internetAccountId,
                    handleClose: (token: string) => {
                      this.handleClose(token)
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

const ApolloLoginForm = ({
  internetAccountId,
  handleClose,
}: {
  internetAccountId: string
  handleClose: (arg?: string) => void
}) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (username && password) {
      const data = {
        username,
        password,
      }
      // const response = await fetch(`http://localhost:8084/api/authenticate`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(data),
      // })

      // if (!response.ok) handleClose()
      // const token = await response.text()
      const token =
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmb28iLCJleHAiOjE2MzQ2MTE3NzgsImlhdCI6MTYzNDU3NTc3OH0.LteCI-zBZPVi2e9UZBCUzRYGuBSSNOtHJPx1amE3Ygs'
      handleClose(token)
    } else {
      handleClose()
    }
    event.preventDefault()
    // event.stopPropagation()
  }

  return (
    <>
      <Dialog open maxWidth="xl" data-testid="login-apollo">
        <DialogTitle>Log In for {internetAccountId}</DialogTitle>
        <form onSubmit={onSubmit}>
          <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
            <TextField
              required
              label="Username"
              variant="outlined"
              inputProps={{ 'data-testid': 'login-apollo-username' }}
              onChange={event => {
                setUsername(event.target.value)
              }}
              margin="dense"
            />
            <TextField
              required
              label="Password"
              type="password"
              autoComplete="current-password"
              variant="outlined"
              inputProps={{ 'data-testid': 'login-apollo-password' }}
              onChange={event => {
                setPassword(event.target.value)
              }}
              margin="dense"
            />
          </DialogContent>
          <DialogActions>
            <Button variant="contained" color="primary" type="submit">
              Submit
            </Button>
            <Button
              variant="contained"
              color="default"
              type="submit"
              onClick={() => {
                handleClose()
              }}
            >
              Cancel
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  )
}

export default stateModelFactory
export type ApolloStateModel = ReturnType<typeof stateModelFactory>
export type ApolloModel = Instance<ApolloStateModel>
