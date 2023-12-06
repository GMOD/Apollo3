import * as http from 'node:http'
import * as querystring from 'node:querystring'

import { CliUx, Command, Flags } from '@oclif/core'
import { CLIError, ExitError } from '@oclif/core/lib/errors'

import { KeycloakService } from '../../services/keycloak.service'
import {
  UserCredentials,
  getUserCredentials,
  saveUserCredentials,
  waitFor,
} from '../../utils'

import EventEmitter = require('node:events')

interface AuthorizationCodeCallbackParams {
  access_token: string
}

export default class AuthLogin extends Command {
  static description = 'Login to Apollo'

  keycloakService = new KeycloakService()

  static flags = {
    address: Flags.string({
      char: 'a',
      description: 'Address of Apollo server',
      default: 'http://localhost:3999',
      required: false,
    }),
    username: Flags.string({
      char: 'u',
      description: 'Username for root login',
      default: '',
      required: false,
    }),
    password: Flags.string({
      char: 'p',
      description: 'Password for <username>',
      default: '',
      required: false,
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(AuthLogin)
    try {
      await this.checkUserAlreadyLoggedIn()

      let userCredentials: UserCredentials = {
        accessToken: '',
        refreshToken: '',
      }

      if (flags.username !== '') {
        userCredentials = await this.startRootLogin(flags.address, flags.username, flags.password)
      } else {
        userCredentials = await this.startAuthorizationCodeFlow(flags.address)
        CliUx.ux.action.stop('done ✅')
      }
      saveUserCredentials(userCredentials)

      // For testing
      //const response = await fetch(`${flags.address}/assemblies`, {
      //   headers: { Authorization: `Bearer ${userCredentials.accessToken}` },
      //})
      //console.log(`Access token: ${userCredentials.accessToken}`)
      //console.log(await response.json())

    } catch (error) {
      if (
        (error instanceof CLIError && error.message === 'ctrl-c') ||
        error instanceof ExitError
      ) {
        this.exit(0)
      } else if (error instanceof Error) {
        CliUx.ux.action.stop(error.message)
        this.exit(1)
      }
    }
  }

  private async checkUserAlreadyLoggedIn() {
    const userCredentials = getUserCredentials()

    if (!userCredentials) {
      return
    }

    const alreadyLoggedIn = (
      Object.keys(userCredentials) as (keyof typeof userCredentials)[]
    ).every((key) => Boolean(userCredentials[key]))

    if (!alreadyLoggedIn) {
      return
    }

    const reAuthenticate = await CliUx.ux.confirm(
      "You're already logged. Do you want to re-authenticate? (y/n)",
    )

    if (!reAuthenticate) {
      this.exit(0)
    }
  }

  private async startRootLogin(address: string, username: string, password: string): Promise<UserCredentials> {
    const url = `${address}/auth/root`
    const response = await fetch(url, {
      headers: new Headers({ 'Content-Type': 'application/json' }),
      method: 'POST',
      body: JSON.stringify({ username: username, password: password }),
    })
    if(! response.ok) {
      // FIXME: Better error handling
      throw new Error('Failed to post request')
    }

    const dat = await response.json()
    return {
      accessToken: dat.token,
      refreshToken: '',
    }
  }

  private async startAuthorizationCodeFlow(
    address: string,
  ): Promise<UserCredentials> {
    const callbackPath = '/'
    const authorizationCodeURL = `${address}/auth/google?client_id=1054515969695-3hpfg1gd0ld3sgj135kfgikolu86vv30.apps.googleusercontent.com&redirect_uri=http://localhost:3000/auth/callback&response_type=code&token_access_type=offline&state=http%3A%2F%2Flocalhost%3A3000`

    const emitter = new EventEmitter()
    const eventName = 'authorication_code_callback_params'
    const port = 3000
    const server = http
      .createServer((req, res) => {
        if (req?.url?.startsWith(callbackPath)) {
          const params = querystring.decode(
            req?.url.replace(`${callbackPath}?`, ''),
          )

          emitter.emit(eventName, params)

          res.end('You can close this browser now.')

          res.socket?.end()
          res.socket?.destroy()
          server.close()
        } else {
          // TODO: handle an invalid URL address
          console.log(req.url)
          res.end('Unsupported')
          emitter.emit(eventName, new Error('Invalid URL address'))
        }
      })
      .listen(port)

    await CliUx.ux.anykey('Press any key to open Keycloak in your browser')

    await CliUx.ux.open(authorizationCodeURL)

    CliUx.ux.action.start('Waiting for authentication')

    const { access_token } = await waitFor<AuthorizationCodeCallbackParams>(
      eventName,
      emitter,
    )
    return {
      accessToken: access_token,
      refreshToken: '',
    }
  }
}
