import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
} from '@mui/material'
import React from 'react'
import { makeStyles } from 'tss-react/mui'

import { GoogleButton, GuestButton, MicrosoftButton } from './LoginButtons'

const useStyles = makeStyles()((theme) => ({
  divider: {
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(5),
  },
}))

export const AuthTypeSelector = ({
  name,
  handleClose,
  google,
  microsoft,
  allowGuestUser,
}: {
  baseURL: string
  name: string
  handleClose: (type?: 'google' | 'microsoft' | 'guest' | Error) => void
  google: boolean
  microsoft: boolean
  allowGuestUser: boolean
}) => {
  const { classes } = useStyles()
  function handleClick(authType: 'google' | 'microsoft' | 'guest') {
    if (authType === 'google') {
      handleClose('google')
    } else if (authType === 'microsoft') {
      handleClose('microsoft')
    } else {
      handleClose('guest')
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
        {allowGuestUser ? (
          <>
            <Divider className={classes.divider} />
            <GuestButton onClick={() => handleClick('guest')} />
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
    </Dialog>
  )
}
