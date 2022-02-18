import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@material-ui/core'
import React, { useState } from 'react'

export const ApolloLoginForm = ({
  baseURL,
  internetAccountId,
  handleClose,
}: {
  baseURL: string
  internetAccountId: string
  handleClose: (token?: string | Error) => void
}) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (username && password) {
      const res = await fetch(new URL('/auth/login', baseURL).href, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      // If authentication was successfull then there is key 'token'
      if ('token' in data) {
        const responseToken = data.token
        handleClose(responseToken)
      } else {
        handleClose(new Error('Authentication failed'))
      }
    } else {
      handleClose()
    }
    event.preventDefault()
  }
  return (
    <>
      <Dialog open maxWidth="xl" data-testid="login-apollo">
        <DialogTitle>Login for {internetAccountId}</DialogTitle>
        <form onSubmit={onSubmit}>
          <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
            <TextField
              required
              label="Username"
              variant="outlined"
              inputProps={{ 'data-testid': 'login-apollo-username' }}
              onChange={(event) => {
                setUsername(event.target.value)
              }}
              margin="dense"
            />
            <TextField
              required
              label="Password"
              type="password"
              autoComplete="current-password"
              variant="outlined"
              inputProps={{ 'data-testid': 'login-apollo-password' }}
              onChange={(event) => {
                setPassword(event.target.value)
              }}
              margin="dense"
            />
          </DialogContent>
          <DialogActions>
            <Button variant="contained" color="primary" type="submit">
              Submit
            </Button>
            <Button
              variant="contained"
              color="default"
              type="submit"
              onClick={() => {
                handleClose()
              }}
            >
              Cancel
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  )
}
