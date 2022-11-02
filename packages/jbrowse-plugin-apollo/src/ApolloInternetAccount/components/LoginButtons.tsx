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
  return (
    <Button
      className={classes.loginButton}
      variant="outlined"
      startIcon={<Google />}
      {...props}
    >
      Sign in with Google
    </Button>
  )
}

export function MicrosoftButton(props: ButtonProps) {
  const { classes } = useStyles()
  return (
    <Button
      className={classes.loginButton}
      variant="outlined"
      startIcon={<Microsoft />}
      {...props}
    >
      Sign in with Microsoft
    </Button>
  )
}
