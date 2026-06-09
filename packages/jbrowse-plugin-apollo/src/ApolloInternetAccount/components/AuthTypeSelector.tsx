/* eslint-disable @typescript-eslint/use-unknown-in-catch-callback-variable */
import { isAbortException } from '@jbrowse/core/util/aborting'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  Divider,
  TextField,
} from '@mui/material'
import React, { useEffect, useState } from 'react'

import { Dialog } from '../../components/Dialog'
import { createFetchErrorMessage } from '../../util'

import {
  GoogleButton,
  GuestButton,
  LoginGovButton,
  MicrosoftButton,
} from './LoginButtons'

const useStyles = makeStyles()((theme) => ({
  divider: {
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(5),
  },
}))

export const AuthTypeSelector = ({
  baseURL,
  handleClose,
  name,
}: {
  baseURL: string
  name: string
  handleClose: (
    type?:
      | 'google'
      | 'microsoft'
      | 'logingov'
      | 'guest'
      | { type: 'local'; identifier: string; password: string }
      | Error,
  ) => void
}) => {
  const { classes } = useStyles()
  const [errorMessage, setErrorMessage] = useState('')
  const [loginTypes, setLoginTypes] = useState<string[]>([])
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false)
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
      const data = (await response.json()) as string[]
      setLoginTypes(data)
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

  function handleClick(
    authType: 'google' | 'microsoft' | 'logingov' | 'guest',
  ) {
    if (authType === 'google') {
      handleClose('google')
    } else if (authType === 'microsoft') {
      handleClose('microsoft')
    } else if (authType === 'logingov') {
      handleClose('logingov')
    } else {
      handleClose('guest')
    }
  }

  async function submitLocalLogin() {
    if (!identifier || !password) {
      setErrorMessage('Local login requires username/email and password')
      return
    }

    setIsSubmittingLocal(true)
    setErrorMessage('')
    try {
      const uri = new URL('auth/local', baseURL).href
      const response = await fetch(uri, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier, password }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          setErrorMessage('Invalid username/email or password')
          return
        }
        const newErrorMessage = await createFetchErrorMessage(
          response,
          'Error when logging in locally',
        )
        setErrorMessage(newErrorMessage)
        return
      }

      handleClose({ type: 'local', identifier, password })
    } catch (error) {
      setErrorMessage(String(error))
    } finally {
      setIsSubmittingLocal(false)
    }
  }

  const allowGoogle = loginTypes.includes('google')
  const allowMicrosoft = loginTypes.includes('microsoft')
  const allowLoginGov = loginTypes.includes('logingov')
  const allowLocal = loginTypes.includes('local')
  const allowGuest = loginTypes.includes('guest')
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
        {allowGoogle ? (
          <GoogleButton
            disabled={!allowGoogle}
            onClick={() => {
              handleClick('google')
            }}
          />
        ) : null}
        {allowMicrosoft ? (
          <MicrosoftButton
            disabled={!allowMicrosoft}
            onClick={() => {
              handleClick('microsoft')
            }}
          />
        ) : null}
        {allowLoginGov ? (
          <LoginGovButton
            disabled={!allowLoginGov}
            onClick={() => {
              handleClick('logingov')
            }}
          />
        ) : null}
        {allowLocal ? (
          <>
            <Divider className={classes.divider} />
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                width: 280,
              }}
            >
              <TextField
                label="Username or email"
                size="small"
                value={identifier}
                onChange={(event) => {
                  setIdentifier(event.target.value)
                }}
              />
              <TextField
                label="Password"
                size="small"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                }}
              />
              <Button
                variant="outlined"
                disabled={isSubmittingLocal}
                onClick={() => {
                  void submitLocalLogin()
                }}
              >
                {isSubmittingLocal ? 'Signing in...' : 'Sign in locally'}
              </Button>
            </Box>
          </>
        ) : null}
        {allowGuest ? (
          <>
            <Divider className={classes.divider} />
            <GuestButton
              onClick={() => {
                handleClick('guest')
              }}
            />
          </>
        ) : null}
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
