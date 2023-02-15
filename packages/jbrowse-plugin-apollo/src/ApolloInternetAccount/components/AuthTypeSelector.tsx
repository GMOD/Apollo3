import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material'
import React from 'react'

import { GoogleButton, MicrosoftButton } from './LoginButtons'

export const AuthTypeSelector = ({
  baseURL,
  name,
  handleClose,
  google = true,
  microsoft = true,
}: {
  baseURL: string
  name: string
  handleClose: (type?: 'google' | 'microsoft' | Error) => void
  google: boolean
  microsoft: boolean
}) => {
  function handleClick(authType: 'google' | 'microsoft') {
    if (authType === 'google') {
      handleClose('google')
    } else {
      handleClose('microsoft')
    }
  }
  // convert component to string useable in data-uri
  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Log in to {name}</DialogTitle>
      <DialogContent
        style={{ display: 'flex', flexDirection: 'column', paddingTop: 8 }}
      >
        <GoogleButton
          disabled={!google}
          onClick={() => handleClick('google')}
        />
        <MicrosoftButton
          disabled={!microsoft}
          onClick={() => handleClick('microsoft')}
        />
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
    </Dialog>
  )
}
