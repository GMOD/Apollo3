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
  handleClose: (token?: string | Error) => void
}) => {
  function handleClick() {
    handleClose('google')
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
          <GoogleButton type="light" onClick={handleClick} />
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
