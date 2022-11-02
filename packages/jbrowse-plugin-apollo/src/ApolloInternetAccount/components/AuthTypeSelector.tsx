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
}: {
  baseURL: string
  name: string
  handleClose: (type?: 'google' | 'microsoft' | Error) => void
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
    <>
      <Dialog open maxWidth="xl" data-testid="login-apollo">
        <DialogTitle>Log in to {name}</DialogTitle>
        <DialogContent
          style={{ display: 'flex', flexDirection: 'column', paddingTop: 8 }}
        >
          <GoogleButton onClick={() => handleClick('google')} />
          <MicrosoftButton onClick={() => handleClick('microsoft')} />
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
    </>
  )
}
