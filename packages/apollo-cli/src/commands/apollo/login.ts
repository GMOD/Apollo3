import EventEmitter from 'node:events'
import * as http from 'node:http'
import * as querystring from 'node:querystring'

import { Command, Flags, ux } from '@oclif/core'
import { CLIError, ExitError } from '@oclif/core/lib/errors'
import open from 'open'

import {
  UserCredentials,
  getUserCredentials,
  saveUserCredentials,
  waitFor,
} from '../../utils'

interface AuthorizationCodeCallbackParams {
  access_token: string
}

export default class Login extends Command {
  static description = 'Log in to Apollo'

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
    const { flags } = await this.parse(Login)
    try {
      await this.checkUserAlreadyLoggedIn()

      let userCredentials: UserCredentials = { accessToken: '' }

      if (flags.username === '') {
        userCredentials = await this.startAuthorizationCodeFlow(flags.address)
        ux.action.stop('done ✅')
      } else {
        userCredentials = await this.startRootLogin(
          flags.address,
          flags.username,
          flags.password,
        )
      }
      saveUserCredentials(userCredentials)

      // For testing
      // const response = await fetch(`${flags.address}/assemblies`, {
      //   headers: { Authorization: `Bearer ${userCredentials.accessToken}` },
      // })
      // console.log(`Access token: ${userCredentials.accessToken}`)
      // console.log(await response.json())
    } catch (error) {
      if (
        (error instanceof CLIError && error.message === 'ctrl-c') ||
        error instanceof ExitError
      ) {
        this.exit(0)
      } else if (error instanceof Error) {
        ux.action.stop(error.message)
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

    const reAuthenticate = await ux.confirm(
      "You're already logged. Do you want to re-authenticate? (y/n)",
    )

    if (!reAuthenticate) {
      this.exit(0)
    }
  }

  private async startRootLogin(
    address: string,
    username: string,
    password: string,
  ): Promise<UserCredentials> {
    const url = `${address}/auth/root`
    // @ts-expect-error https://github.com/DefinitelyTyped/DefinitelyTyped/pull/66824
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    if (!response.ok) {
      // FIXME: Better error handling
      throw new Error('Failed to post request')
    }

    const dat = await response.json()
    return { accessToken: dat.token }
  }

  private async startAuthorizationCodeFlow(
    address: string,
  ): Promise<UserCredentials> {
    const callbackPath = '/'
    const authorizationCodeURL = `${address}/auth?type=google&redirect_uri=http://localhost:3000/auth/callback`

    // eslint-disable-next-line unicorn/prefer-event-target
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
          res.end('Unsupported')
          emitter.emit(eventName, new Error('Invalid URL address'))
        }
      })
      .listen(port)

    await ux.anykey('Press any key to open Keycloak in your browser')

    await open(authorizationCodeURL)

    ux.action.start('Waiting for authentication')

    const { access_token } = await waitFor<AuthorizationCodeCallbackParams>(
      eventName,
      emitter,
    )
    return { accessToken: access_token }
  }
}
