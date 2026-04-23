/* eslint-disable @typescript-eslint/use-unknown-in-catch-callback-variable */
import { isAbortException } from '@jbrowse/core/util/aborting'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  Divider,
} from '@mui/material'
import React, { useEffect, useState } from 'react'

import { Dialog } from '../../components/Dialog'
import { createFetchErrorMessage } from '../../util'

import {
  GenericButton,
  GoogleButton,
  GuestButton,
  MicrosoftButton,
} from './LoginButtons'

const useStyles = makeStyles()((theme) => ({
  divider: {
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(5),
  },
}))

interface AuthType {
  name: string
  message: string
  needsPopup: boolean
}

export const AuthTypeSelector = ({
  baseURL,
  handleClose,
  name,
}: {
  baseURL: string
  name: string
  handleClose: (type?: AuthType | Error) => void
}) => {
  const { classes } = useStyles()
  const [errorMessage, setErrorMessage] = useState('')
  const [loginTypes, setLoginTypes] = useState<null | AuthType[]>(null)
  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function getAuthTypes() {
      const uri = new URL('auth/types', baseURL).href
      const response = await fetch(uri, { method: 'GET', signal })
      if (!response.ok) {
        const newErrorMessage = await createFetchErrorMessage(
          response,
          'Error when retrieving auth types from server',
        )
        setErrorMessage(newErrorMessage)
        return
      }
      const data = (await response.json()) as AuthType[]
      setLoginTypes(data)
      if (data.length === 0) {
        setErrorMessage('No login types configured')
      }
    }
    getAuthTypes().catch((error) => {
      if (!isAbortException(error)) {
        setErrorMessage(String(error))
      }
    })
    return () => {
      controller.abort(
        new DOMException(
          'Error retrieving valid authentication types',
          'AbortError',
        ),
      )
    }
  }, [baseURL])

  function handleClick(authType: AuthType) {
    handleClose(authType)
  }

  if (loginTypes === null) {
    return 'Loading…'
  }

  const firstLoginType = loginTypes.at(0)

  if (firstLoginType && loginTypes.length === 1 && !firstLoginType.needsPopup) {
    handleClick(firstLoginType)
  }

  return (
    <Dialog
      open
      title={`Log in to ${name}`}
      handleClose={handleClose}
      maxWidth={false}
      data-testid="login-apollo"
    >
      <DialogContent
        style={{ display: 'flex', flexDirection: 'column', paddingTop: 8 }}
      >
        {loginTypes.map((loginType) => {
          if (loginType.name === 'google') {
            return (
              <GoogleButton
                key={loginType.name}
                message={loginType.message}
                onClick={() => {
                  handleClick(loginType)
                }}
              />
            )
          }
          if (loginType.name === 'microsoft') {
            return (
              <MicrosoftButton
                key={loginType.name}
                message={loginType.message}
                onClick={() => {
                  handleClick(loginType)
                }}
              />
            )
          }
          if (loginType.name === 'guest') {
            return (
              <React.Fragment key={loginType.name}>
                <Divider className={classes.divider} />
                <GuestButton
                  message={loginType.message}
                  onClick={() => {
                    handleClick(loginType)
                  }}
                />
              </React.Fragment>
            )
          }
          return (
            <GenericButton
              key={loginType.name}
              message={loginType.message}
              onClick={() => {
                handleClick(loginType)
              }}
            />
          )
        })}
      </DialogContent>
      <DialogActions>
        <Button
          variant="outlined"
          type="submit"
          onClick={() => {
            handleClose()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
      {errorMessage ? (
        <DialogContent>
          <DialogContentText color="error">{errorMessage}</DialogContentText>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
