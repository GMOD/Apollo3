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
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { readConfObject } from '@jbrowse/core/configuration'

const useStyles = makeStyles(theme => ({
  loginPaper: {
    padding: theme.spacing(4),
  },
}))

interface LoginModalProps {
  resolve(): void
  apolloConfig: AnyConfigurationModel
}

function LoginModal({ resolve, apolloConfig }: LoginModalProps) {
  const classes = useStyles()
  const [checkLoginResponse, setCheckLoginResponse] = useState<
    Record<string, any>
  >()
  const [error, setError] = useState('')
  const apolloId = readConfObject(apolloConfig, 'apolloId')

  const username = sessionStorage.getItem(`${apolloId}-apolloUsername`)
  const password = sessionStorage.getItem(`${apolloId}-apolloPassword`)

  const apolloUrl = readConfObject(apolloConfig, ['location', 'uri'])

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
  }, [username, password, apolloUrl])

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
          <LoginContents
            checkLoginResponse={checkLoginResponse}
            error={error}
            apolloConfig={apolloConfig}
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

interface LoginContentsProps {
  checkLoginResponse: undefined | Record<string, any>
  error: string
  apolloConfig: AnyConfigurationModel
  username: string | null
  password: string | null
  resolve(): void
}

function LoginContents({
  checkLoginResponse,
  error,
  apolloConfig,
  username,
  password,
  resolve,
}: LoginContentsProps) {
  if (!checkLoginResponse && !error) {
    return <CircularProgress />
  }
  if (error || !checkLoginResponse?.has_users) {
    const name = readConfObject(apolloConfig, 'name')
    return (
      <Typography color="error">
        Problem accessing Apollo server "{name}"
        <br />
        {error || checkLoginResponse?.error || ''}
      </Typography>
    )
  }
  if (username && password) {
    if (checkLoginResponse?.username) {
      return <Typography>Already logged in</Typography>
    } else {
      const apolloName = readConfObject(apolloConfig, 'name')
      sessionStorage.removeItem(`${apolloName}-apolloUsername`)
      sessionStorage.removeItem(`${apolloName}-apolloPassword`)
    }
  }
  return <LoginForm resolve={resolve} apolloConfig={apolloConfig} />
}

export default observer(LoginModal)
