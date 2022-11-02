import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import GoogleButton from 'react-google-button'
import { makeStyles } from 'tss-react/mui'

import MicrosoftLogo from './microsoftSVG'

const microsoftSvgString = encodeURIComponent(
  renderToStaticMarkup(<MicrosoftLogo />),
)
const useStyles = makeStyles()(() => ({
  microsoftButton: {
    width: '240px',
    height: '50px',
    fontSize: '16px',
    color: 'rgba(110, 110, 110)',
    textTransform: 'none',
    paddingLeft: '50px',
    border: '0',
    boxShadow: '0 3px 5px 2px rgba(210, 210, 210)',
    backgroundImage: `url("data:image/svg+xml,${microsoftSvgString}")`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: '30px 30px',
    backgroundPositionY: 'center',
    backgroundPositionX: '10px',
  },
}))

export const AuthTypeSelector = ({
  baseURL,
  name,
  handleClose,
}: {
  baseURL: string
  name: string
  handleClose: (type?: 'google' | 'microsoft' | Error) => void
}) => {
  const { classes } = useStyles()
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
          {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
          {/* @ts-ignore */}
          <GoogleButton type="light" onClick={() => handleClick('google')} />
          <Button
            className={classes.microsoftButton}
            onClick={() => handleClick('microsoft')}
          >
            Sign in with Microsoft
          </Button>
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
