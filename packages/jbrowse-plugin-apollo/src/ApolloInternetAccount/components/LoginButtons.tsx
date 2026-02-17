import { makeStyles } from '@jbrowse/core/util/tss-react'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import BusinessIcon from '@mui/icons-material/Business'
import { Button, type ButtonProps } from '@mui/material'
import React from 'react'

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

interface LoginButtonProps extends ButtonProps {
  message: string
}

export function GoogleButton(props: LoginButtonProps) {
  const { classes } = useStyles()
  const { message } = props
  return (
    <Button
      className={classes.loginButton}
      variant="outlined"
      startIcon={<Google />}
      {...props}
    >
      {message}
    </Button>
  )
}

export function MicrosoftButton(props: LoginButtonProps) {
  const { classes } = useStyles()
  const { message } = props
  return (
    <Button
      className={classes.loginButton}
      variant="outlined"
      startIcon={<Microsoft />}
      {...props}
    >
      {message}
    </Button>
  )
}

export function GuestButton(props: LoginButtonProps) {
  const { classes } = useStyles()
  const { message } = props
  return (
    <Button
      className={classes.loginButton}
      variant="outlined"
      startIcon={<AccountCircleIcon fontSize="small" />}
      {...props}
    >
      {message}
    </Button>
  )
}

export function GenericButton(props: LoginButtonProps) {
  const { classes } = useStyles()
  const { message } = props
  return (
    <Button
      className={classes.loginButton}
      variant="outlined"
      startIcon={<BusinessIcon fontSize="small" />}
      {...props}
    >
      {message}
    </Button>
  )
}
