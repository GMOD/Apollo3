import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import { Button, ButtonProps } from '@mui/material'
import React from 'react'
import { makeStyles } from 'tss-react/mui'

import { Google, Microsoft } from './LoginIcons'

const useStyles = makeStyles()((theme) => ({
  loginButton: {
    marginBottom: theme.spacing(1),
    width: '220px',
    height: '40px',
    fontSize: '16px',
    textTransform: 'none',
    justifyContent: 'left',
    padding: '3px 12px',
  },
}))

export function GoogleButton(props: ButtonProps) {
  const { classes } = useStyles()
  const { disabled } = props
  return (
    <Button
      className={classes.loginButton}
      variant="outlined"
      startIcon={<Google color={disabled ? 'disabled' : undefined} />}
      {...props}
    >
      Sign in with Google
    </Button>
  )
}

export function MicrosoftButton(props: ButtonProps) {
  const { classes } = useStyles()
  const { disabled } = props
  return (
    <Button
      className={classes.loginButton}
      variant="outlined"
      startIcon={<Microsoft color={disabled ? 'disabled' : undefined} />}
      {...props}
    >
      Sign in with Microsoft
    </Button>
  )
}

export function GuestButton(props: ButtonProps) {
  const { classes } = useStyles()
  return (
    <Button
      className={classes.loginButton}
      variant="outlined"
      startIcon={<AccountCircleIcon fontSize="small" />}
      {...props}
    >
      Continue as Guest
    </Button>
  )
}
