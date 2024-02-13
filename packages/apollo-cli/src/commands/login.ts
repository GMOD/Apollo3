import EventEmitter from 'node:events'
import * as http from 'node:http'
import path from 'node:path'
import * as querystring from 'node:querystring'

import { Errors, Flags, ux } from '@oclif/core'
import open from 'open'

import { BaseCommand } from '../baseCommand.js'
import { Config } from '../Config.js'
import {
  ConfigError,
  UserCredentials,
  basicCheckConfig,
  getUserCredentials,
  waitFor,
} from '../utils.js'

interface AuthorizationCodeCallbackParams {
  access_token: string
}

export default class Login extends BaseCommand<typeof Login> {
  static description = 'Log in to Apollo'

  static flags = {
    address: Flags.string({
      char: 'a',
      description: 'Address of Apollo server',
      required: false,
    }),
    username: Flags.string({
      char: 'u',
      description: 'Username for root login',
      required: false,
    }),
    password: Flags.string({
      char: 'p',
      description: 'Password for <username>',
      required: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Force re-authentication even if user is already logged in',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Login)

    let configFile = flags['config-file']
    if (configFile === undefined) {
      configFile = path.join(this.config.configDir, 'config.yaml')
    }
    try {
      basicCheckConfig(configFile, flags.profile)
    } catch (error) {
      if (error instanceof ConfigError) {
        this.logToStderr(error.message)
        this.exit(1)
      }
    }

    const config: Config = new Config(configFile)

    const accessType: string | undefined = config.get(
      'accessType',
      flags.profile,
    )
    const address: string | undefined =
      flags.address ?? config.get('address', flags.profile)
    if (address === undefined) {
      this.logToStderr('Address to apollo must be set')
      this.exit(1)
    }

    let userCredentials: UserCredentials = { accessToken: '' }

    try {
      if (!flags.force) {
        await this.checkUserAlreadyLoggedIn()
      }
      if (accessType === 'root' || flags.username !== undefined) {
        const username: string | undefined =
          flags.username ??
          config.get('rootCredentials.username', flags.profile)
        const password: string | undefined =
          flags.password ??
          config.get('rootCredentials.password', flags.profile)
        if (username === undefined || password === undefined) {
          this.logToStderr('Username and password must be set')
          this.exit(1)
        }
        userCredentials = await this.startRootLogin(address, username, password)
      } else if (accessType === 'guest') {
        userCredentials = await this.startGuestLogin(address)
      } else if (accessType === undefined) {
        this.logToStderr('Undefined access type')
        this.exit(1)
      } else {
        userCredentials = await this.startAuthorizationCodeFlow(
          address,
          accessType,
        )
      }
    } catch (error) {
      if (
        (error instanceof Errors.CLIError && error.message === 'ctrl-c') ||
        error instanceof Errors.ExitError
      ) {
        this.exit(0)
      } else if (error instanceof Error) {
        this.logToStderr(error.message)
        ux.action.stop(error.message)
        this.exit(1)
      }
    }
    config.set('accessToken', userCredentials.accessToken, flags.profile)
    config.writeConfigFile()
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

  private async startGuestLogin(address: string): Promise<UserCredentials> {
    const url = `${address}/auth/login?type=guest`
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
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
    accessType: string,
  ): Promise<UserCredentials> {
    const callbackPath = '/'
    const port = 3000
    const authorizationCodeURL = `${address}/auth/login?type=${accessType}&redirect_uri=http://localhost:${port}${callbackPath}`

    // eslint-disable-next-line unicorn/prefer-event-target
    const emitter = new EventEmitter()
    const eventName = 'authorication_code_callback_params'
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

    await ux.anykey('Press any key to open your browser')

    await open(authorizationCodeURL)

    ux.action.start('Waiting for authentication')

    const { access_token } = await waitFor<AuthorizationCodeCallbackParams>(
      eventName,
      emitter,
    )
    return { accessToken: access_token }
  }
}
