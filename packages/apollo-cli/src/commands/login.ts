/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import EventEmitter from 'node:events'
import * as http from 'node:http'
import path from 'node:path'
import * as querystring from 'node:querystring'

import { Errors, Flags, ux } from '@oclif/core'
import open from 'open'
import { fetch } from 'undici'

import { BaseCommand } from '../baseCommand.js'
import { Config } from '../Config.js'
import {
  UserCredentials,
  basicCheckConfig,
  createFetchErrorMessage,
  getUserCredentials,
  localhostToAddress,
  waitFor,
  wrapLines,
} from '../utils.js'

interface AuthorizationCodeCallbackParams {
  access_token: string
}

export default class Login extends BaseCommand<typeof Login> {
  static summary = 'Login to Apollo'
  static description = wrapLines(
    'Use the provided credentials to obtain and save the token to access Apollo. Once the token for \
    the given profile has been saved in the configuration file, users do not normally need to execute \
    this command again unless the token has expired. To setup a new profile use "apollo config"',
  )

  static examples = [
    {
      description: wrapLines(
        'The most basic and probably most typical usage is to login using the default profile in configuration file:',
      ),
      command: '<%= config.bin %> <%= command.id %>',
    },
    {
      description: wrapLines('Login with a different profile:'),
      command: '<%= config.bin %> <%= command.id %> --profile my-profile',
    },
  ]

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
    port: Flags.integer({
      description:
        'Get token by listening to this port number (usually this is >= 1024 and < 65536)',
      default: 3000,
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Login)

    let configFile = flags['config-file']
    if (configFile === undefined) {
      configFile = path.join(this.config.configDir, 'config.yaml')
    }

    let profileName = flags.profile
    if (profileName === undefined) {
      profileName = process.env.APOLLO_PROFILE ?? 'default'
    }
    basicCheckConfig(configFile, profileName)
    const config: Config = new Config(configFile)

    const accessType: string | undefined = config.get('accessType', profileName)
    const address: string | undefined =
      flags.address ?? config.get('address', profileName)
    if (address === undefined) {
      this.error('Address to apollo must be set')
    }

    let userCredentials: UserCredentials = { accessToken: '' }

    try {
      if (!flags.force) {
        await this.checkUserAlreadyLoggedIn()
      }
      if (accessType === 'root' || flags.username !== undefined) {
        const username: string | undefined =
          flags.username ?? config.get('rootCredentials.username', profileName)
        const password: string | undefined =
          flags.password ?? config.get('rootCredentials.password', profileName)
        if (username === undefined || password === undefined) {
          this.error('Username and password must be set')
        }
        userCredentials = await this.startRootLogin(address, username, password)
      } else if (accessType === 'guest') {
        userCredentials = await this.startGuestLogin(address)
      } else if (accessType === undefined) {
        this.error('Undefined access type')
      } else {
        userCredentials = await this.startAuthorizationCodeFlow(
          address,
          accessType,
          flags.port,
        )
      }
    } catch (error) {
      if (
        (error instanceof Errors.CLIError && error.message === 'ctrl-c') ||
        error instanceof Errors.ExitError
      ) {
        return
      }
      if (error instanceof Error) {
        throw error
      }
    }
    config.set('accessToken', userCredentials.accessToken, profileName)
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
    const url = localhostToAddress(`${address}/auth/root`)
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    if (!response.ok) {
      const errorMessage = await createFetchErrorMessage(
        response,
        'startRootLogin failed',
      )
      throw new Error(errorMessage)
    }
    const dat = await response.json()
    if (typeof dat === 'object' && dat !== null && 'token' in dat) {
      return { accessToken: dat.token as string }
    }
    throw new Error(`Unexpected response: ${JSON.stringify(dat)}`)
  }

  private async startGuestLogin(address: string): Promise<UserCredentials> {
    const url = localhostToAddress(`${address}/auth/login?type=guest`)
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) {
      const errorMessage = await createFetchErrorMessage(
        response,
        'startGuestLogin failed',
      )
      throw new Error(errorMessage)
    }
    const dat = await response.json()
    if (typeof dat === 'object' && dat !== null && 'token' in dat) {
      return { accessToken: dat.token as string }
    }
    throw new Error(`Unexpected response: ${JSON.stringify(dat)}`)
  }

  private async startAuthorizationCodeFlow(
    address: string,
    accessType: string,
    port: number,
  ): Promise<UserCredentials> {
    const callbackPath = '/'
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
          res.end(
            'This browser window was opened by `apollo login`, you can close it now.',
          )
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

    server.on('error', async (e) => {
      if (e.message.includes('EADDRINUSE')) {
        this.logToStderr(
          `It appears that port ${port} is in use. Perhaps you have JBrowse running?\nTry using a different port using the --port option or temporarily stop JBrowse`,
        )
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(1)
      } else {
        this.logToStderr(e.message)
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(1)
      }
    })

    // await ux.anykey('Press any key to open your browser') // Do we need this?
    const authorizationCodeURL = `${address}/auth/login?type=${accessType}&redirect_uri=http://localhost:${port}${callbackPath}`
    await open(authorizationCodeURL)
    ux.action.start('Waiting for authentication')

    const { access_token } = await waitFor<AuthorizationCodeCallbackParams>(
      eventName,
      emitter,
    )

    return { accessToken: access_token }
  }
}
