import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material'
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
      if (!res.ok) {
        let errorMessage
        try {
          errorMessage = await res.text()
        } catch (e) {
          errorMessage = ''
        }
        handleClose(
          new Error(
            `Authentication failed — ${res.status} (${res.statusText})${
              errorMessage ? ` (${errorMessage})` : ''
            }`,
          ),
        )
      }
      const data = await res.json()
      // If authentication was successfull then there is key 'token'
      if ('token' in data) {
        const responseToken = data.token
        handleClose(responseToken)
      } else {
        handleClose(new Error('Authentication failed — no token in response'))
      }
    } else {
      handleClose()
    }
    event.preventDefault()
  }

  // async function onSubmitGoogle(event: React.FormEvent<HTMLFormElement>) {
  //   event.preventDefault()

  //   const currentUrl = window.location.href
  //   console.log(`currentUrl: ${JSON.stringify(currentUrl)}`)

  //   // const encodedParam = encodeURI(`?redirectUrl=http://localhost:3000/?config=http%3A%2F%2Flocalhost%3A9000%2Fjbrowse_config.json`)
  //   const encodedParam = encodeURI(`?redirectUrl=${currentUrl}`)
  //   console.log(`PARAM: ${JSON.stringify(encodedParam)}`)
  //   window.location.href = `http://localhost:3999/auth/google/redirect${encodedParam}`
  //   // window.location.href = `http://localhost:3999/auth/google/login${encodedParam}`
  //   // window.location.href = 'http://localhost:3999/auth/google/login'
  //   // const res = await fetch(new URL('/auth/google/login', baseURL).href, {
  //   //   method: 'GET',
  //   //   headers: {
  //   //     'Content-Type': 'application/json'
  //   //   },
  //   // })
  //   // const data = await res.json()
  //   // // If authentication was successfull then there is key 'token'
  //   // if ('token' in data) {
  //   //   const responseToken = data.token
  //   //   handleClose(responseToken)
  //   // } else {
  //   //   handleClose(new Error('Authentication failed — no token in response'))
  //   // }
  //   handleClose('responseToken')
  //   event.preventDefault()
  // }

  // const createGoogleAuthLink = async () => {
  //   window.location.href = 'http://localhost:3999/auth/google/login'
  //   // try {
  //   //   const request = await fetch('http://localhost:8080/createAuthLink', {
  //   //     method: 'POST',
  //   //   })
  //   //   const response = await request.json()
  //   //   window.location.href = response.url
  //   // } catch (error) {
  //   //   console.log('App.js 12 | error', error)
  //   //   throw new Error('Issue with Login', error.message)
  //   // }
  // }
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
            <Button variant="contained" type="submit">
              Submit
            </Button>
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
        </form>
        {/* <form onSubmit={onSubmitGoogle}>
          <DialogActions>
            <Button variant="contained" type="submit">
              Use Google Authentication
            </Button>
          </DialogActions>
        </form> */}
      </Dialog>
    </>
  )
}
