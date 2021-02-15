import ErrorIcon from '@material-ui/icons/Error'
import {
  Button,
  // Checkbox,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  // FormControlLabel,
  TextField,
  makeStyles,
} from '@material-ui/core'
import { observer } from 'mobx-react'
import React, { useEffect, useState } from 'react'
import apolloUrl from '../apolloUrl'

const useStyles = makeStyles(theme => ({
  errorIcon: {
    marginRight: theme.spacing(2),
  },
}))

function LoginForm({ resolve }: { resolve(): void }) {
  const classes = useStyles()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  // const [rememberMe, setRememberMe] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!submitted) {
      return
    }
    const data = { username, password /*, rememberMe */ }
    const controller = new AbortController()
    const { signal } = controller
    async function login() {
      try {
        const response = await fetch(`${apolloUrl}/Login?operation=login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!response.ok) {
          setError(`Error: (${response.status}) ${response.statusText}`)
          setSubmitted(false)
        }
        const content = await response.json()
        if (content.error) {
          setError(content.error)
          setSubmitted(false)
        } else {
          sessionStorage.setItem('apolloUsername', username)
          sessionStorage.setItem('apolloPassword', password)
          resolve()
        }
      } catch (error) {
        if (!signal.aborted) {
          setError(String(error))
          setSubmitted(false)
        }
      }
    }

    login()
    return () => {
      controller.abort()
    }
  }, [submitted, username, /* rememberMe, */ password, resolve])

  function handleUsernameChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    if (error) {
      setError('')
    }
    setUsername(event.target.value)
  }

  function handlePasswordChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    if (error) {
      setError('')
    }
    setPassword(event.target.value)
  }

  // function handleRememberMeChange(event: React.ChangeEvent<HTMLInputElement>) {
  //   setRememberMe(event.target.checked)
  // }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (error) {
      setError('')
    }
    setSubmitted(true)
    event.preventDefault()
  }

  return (
    <>
      <DialogTitle>Sign In</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <TextField
            required
            id="username"
            label="Username"
            variant="outlined"
            onChange={handleUsernameChange}
            disabled={submitted}
            margin="dense"
          />
          <TextField
            required
            id="password-input"
            label="Password"
            type="password"
            autoComplete="current-password"
            variant="outlined"
            onChange={handlePasswordChange}
            disabled={submitted}
            margin="dense"
          />
          {/* <FormControlLabel
            control={
              <Checkbox
                checked={rememberMe}
                onChange={handleRememberMeChange}
                name="rememberMe"
              />
            }
            label="Remember me"
            disabled={submitted}
          /> */}
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            disabled={submitted}
          >
            Submit
          </Button>
        </DialogActions>
      </form>
      {error ? (
        <div>
          <DialogContentText color="error">
            <ErrorIcon className={classes.errorIcon} />
            {error}
          </DialogContentText>
        </div>
      ) : null}
    </>
  )
}

export default observer(LoginForm)
