/* eslint-disable @typescript-eslint/use-unknown-in-catch-callback-variable */
import { isAbortException } from '@jbrowse/core/util/aborting'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  Divider,
} from '@mui/material'
import React, { useEffect, useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { Dialog } from '../../components/Dialog'
import { createFetchErrorMessage } from '../../util'

import { GoogleButton, GuestButton, MicrosoftButton } from './LoginButtons'

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
  handleClose: (type?: 'google' | 'microsoft' | 'guest' | Error) => void
}) => {
  const { classes } = useStyles()
  const [errorMessage, setErrorMessage] = useState('')
  const [loginTypes, setLoginTypes] = useState<string[]>([])
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
      controller.abort()
    }
  }, [baseURL])

  function handleClick(authType: 'google' | 'microsoft' | 'guest') {
    if (authType === 'google') {
      handleClose('google')
    } else if (authType === 'microsoft') {
      handleClose('microsoft')
    } else {
      handleClose('guest')
    }
  }

  const allowGoogle = loginTypes.includes('google')
  const allowMicrosoft = loginTypes.includes('microsoft')
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
