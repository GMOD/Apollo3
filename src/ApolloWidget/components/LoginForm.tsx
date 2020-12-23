import PluginManager from '@jbrowse/core/PluginManager'
import ErrorIcon from '@material-ui/icons/Error'

export default (jbrowse: PluginManager) => {
  const {
    Button,
    Checkbox,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    FormControlLabel,
    Paper,
    TextField,
  } = jbrowse.lib['@material-ui/core']
  const { makeStyles } = jbrowse.lib['@material-ui/core']

  const { observer } = jbrowse.jbrequire('mobx-react')
  const React = jbrowse.jbrequire('react')
  const { useEffect, useState } = jbrowse.lib['react']

  const useStyles = makeStyles(theme => ({
    loginPaper: {
      margin: theme.spacing(4),
      padding: theme.spacing(4),
    },
    errorIcon: {
      marginRight: theme.spacing(2),
    },
  }))

  function LoginForm() {
    const classes = useStyles()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [rememberMe, setRememberMe] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')
    const [userData, setUserData] = useState<Record<string, any>>()

    useEffect(() => {
      if (!submitted) {
        return
      }
      const data = { username, password, rememberMe }
      const controller = new AbortController()
      const { signal } = controller
      async function login() {
        try {
          const response = await fetch(
            'http://demo.genomearchitect.org/Apollo2/Login?operation=login',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            },
          )
          if (!response.ok) {
            setError(`Error: (${response.status}) ${response.statusText}`)
            setSubmitted(false)
          }
          const content = await response.json()
          if (content.error) {
            setError(content.error)
            setSubmitted(false)
          } else {
            setUserData(content)
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
    }, [submitted, username, rememberMe, password])

    function handleUsernameChange(
      event: React.ChangeEvent<HTMLTextAreaElement>,
    ) {
      if (error) {
        setError('')
      }
      setUsername(event.target.value)
    }

    function handlePasswordChange(
      event: React.ChangeEvent<HTMLTextAreaElement>,
    ) {
      if (error) {
        setError('')
      }
      setPassword(event.target.value)
    }

    function handleRememberMeChange(
      event: React.ChangeEvent<HTMLInputElement>,
    ) {
      setRememberMe(event.target.checked)
    }

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
      if (error) {
        setError('')
      }
      setSubmitted(true)
      event.preventDefault()
    }

    return (
      <Paper elevation={8} className={classes.loginPaper}>
        <DialogTitle>Sign In</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <TextField
              required
              id="username"
              label="Username"
              variant="outlined"
              onChange={handleUsernameChange}
              disabled={submitted}
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
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={rememberMe}
                  onChange={handleRememberMeChange}
                  name="rememberMe"
                />
              }
              label="Remember me"
              disabled={submitted}
            />
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
        {userData ? JSON.stringify(userData, null, 2) : null}
      </Paper>
    )
  }

  return observer(LoginForm)
}
