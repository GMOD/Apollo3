import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material'
import React from 'react'
import GoogleButton from 'react-google-button'

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
  return (
    <>
      <Dialog open maxWidth="xl" data-testid="login-apollo">
        <DialogTitle>Log in to {name}</DialogTitle>
        <DialogContent
          style={{ display: 'flex', flexDirection: 'column', paddingTop: 8 }}
        >
          {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
          {/* @ts-ignore */}
          <GoogleButton type="light" onClick={() => handleClick('google')} />
          <Button onClick={() => handleClick('microsoft')}>Microsoft</Button>
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
