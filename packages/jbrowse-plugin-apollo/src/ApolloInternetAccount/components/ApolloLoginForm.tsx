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
  internetAccountId,
  handleClose,
}: {
  internetAccountId: string
  handleClose: (arg?: string) => void
}) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (username && password) {
      // const data = {
      //   username,
      //   password,
      // }
      // const response = await fetch(`http://localhost:8084/api/authenticate`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(data),
      // })

      // if (!response.ok) handleClose()
      // const token = await response.text()
      const token =
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmb28iLCJleHAiOjE2MzQ2MTE3NzgsImlhdCI6MTYzNDU3NTc3OH0.LteCI-zBZPVi2e9UZBCUzRYGuBSSNOtHJPx1amE3Ygs'
      handleClose(token)
    } else {
      handleClose()
    }
    event.preventDefault()
    // event.stopPropagation()
  }

  return (
    <>
      <Dialog open maxWidth="xl" data-testid="login-apollo">
        <DialogTitle>Log In for {internetAccountId}</DialogTitle>
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
