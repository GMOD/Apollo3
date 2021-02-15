import {
  Typography,
  CircularProgress,
  makeStyles,
  Paper,
  Modal,
} from '@material-ui/core'
import { observer } from 'mobx-react'
import React, { useEffect, useState } from 'react'
import LoginForm from './LoginForm'
import apolloUrl from '../apolloUrl'

const useStyles = makeStyles(theme => ({
  loginPaper: {
    padding: theme.spacing(4),
  },
}))

function LoginModal({ resolve }: { resolve(): void }) {
  const classes = useStyles()
  const [checkLoginResponse, setCheckLoginResponse] = useState<
    Record<string, any>
  >()
  const [error, setError] = useState('')

  const username = sessionStorage.getItem('apolloUsername')
  const password = sessionStorage.getItem('apolloPassword')

  useEffect(() => {
    const data = { username, password }
    const controller = new AbortController()
    const { signal } = controller
    async function checkLogin() {
      try {
        const response = await fetch(`${apolloUrl}/user/checkLogin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!response.ok) {
          console.error(response.status, response.statusText)
        }
        const content = await response.json()
        setCheckLoginResponse(content)
      } catch (error) {
        if (!signal.aborted) {
          console.error(error)
          setError(String(error))
        }
      }
    }

    checkLogin()
    return () => {
      controller.abort()
    }
  }, [username, password])

  if (!checkLoginResponse && !error) {
    return (
      <Paper elevation={8} className={classes.loginPaper}>
        <CircularProgress />
      </Paper>
    )
  }

  return (
    <Modal open>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <Paper elevation={8} className={classes.loginPaper}>
          <Contents
            checkLoginResponse={checkLoginResponse}
            error={error}
            apolloUrl={apolloUrl}
            username={username}
            password={password}
            resolve={resolve}
          />
        </Paper>
      </div>
    </Modal>
  )

  // const { model } = props
}

function Contents({
  checkLoginResponse,
  error,
  apolloUrl,
  username,
  password,
  resolve,
}: {
  checkLoginResponse: undefined | Record<string, any>
  error: string
  apolloUrl: string
  username: string | null
  password: string | null
  resolve(): void
}) {
  if (!checkLoginResponse && !error) {
    return <CircularProgress />
  }
  if (error || !checkLoginResponse?.has_users) {
    return (
      <Typography color="error">
        Problem accessing Apollo server at {apolloUrl}
        <br />
        {error || checkLoginResponse?.error || ''}
      </Typography>
    )
  }
  if (username && password) {
    if (checkLoginResponse?.username) {
      return <Typography>Already logged in</Typography>
    } else {
      sessionStorage.removeItem('apolloUsername')
      sessionStorage.removeItem('apolloPassword')
    }
  }
  return <LoginForm resolve={resolve} />
}

export default observer(LoginModal)
