import PluginManager from '@jbrowse/core/PluginManager'
import LoginFormF from './LoginForm'

export default (jbrowse: PluginManager) => {
  const { Paper } = jbrowse.lib['@material-ui/core']

  const { observer } = jbrowse.jbrequire('mobx-react')
  const React = jbrowse.jbrequire('react')
  const LoginForm = jbrowse.jbrequire(LoginFormF)
  const { useEffect, useState } = jbrowse.lib['react']

  function ApolloWidget() {
    const [checkLoginResponse, setCheckLoginResponse] = useState<
      Record<string, any>
    >()

    useEffect(() => {
      const controller = new AbortController()
      const { signal } = controller
      async function checkLogin() {
        try {
          const response = await fetch(
            'http://demo.genomearchitect.org/Apollo2/user/checkLogin',
            { headers: { 'Content-Type': 'application/json' } },
          )
          if (!response.ok) {
            console.error(response.status, response.statusText)
          }
          const content = await response.json()
          setCheckLoginResponse(content)
        } catch (error) {
          if (!signal.aborted) console.error(error)
        }
      }

      checkLogin()
      return () => {
        controller.abort()
      }
    }, [])

    if (checkLoginResponse && checkLoginResponse.has_users) {
      return <LoginForm />
    }

    // const { model } = props
    return (
      <Paper>
        stuff here
        <br />
        {JSON.stringify(checkLoginResponse)}
      </Paper>
    )
  }

  return observer(ApolloWidget)
}
