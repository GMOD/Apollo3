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
  authenticationURL,
  internetAccountId,
  handleClose,
}: {
  authenticationURL: string
  internetAccountId: string
  handleClose: (arg?: string) => void
}) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  async function onSubmit(
    this: unknown,
    event: React.FormEvent<HTMLFormElement>,
  ) {
    if (username && password) {
      const url = new URL(authenticationURL)
      const paramsString = `username=${username}&password=${password}`
      const queryParams = new URLSearchParams(paramsString)
      url.search = queryParams.toString()

      fetch(url.toString(), {
        method: 'POST',
      })
        .then((res) => res.json())
        .then((data) => {
          // If authentication was successfull then there is key 'token'
          if ('token' in data) {
            const responseToken = data.token
            handleClose(responseToken)
          } else {
            alert('Authentication failed')
          }
        })
        .catch((rejected) => {
          alert(rejected)
        })
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
