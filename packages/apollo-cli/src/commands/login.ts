/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { setTimeout as sleep } from 'node:timers/promises'

import { confirm } from '@inquirer/prompts'
import { Errors, Flags, ux } from '@oclif/core'
import open from 'open'
import { fetch } from 'undici'

import { type ApolloConf, KEYS } from '../ApolloConf.js'
import { BaseCommand } from '../baseCommand.js'
import {
  type UserCredentials,
  createFetchErrorMessage,
  localhostToAddress,
} from '../utils.js'

interface LoginType {
  name: string
  needsPopup: boolean
}

interface DeviceLoginResponse {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete: string
  expires_in: number
  interval: number
}

/** error is e.g. "authorization_pending", "slow_down", or "expired_token" */
type DeviceTokenResponse = { token: string } | { error: string }

export default class Login extends BaseCommand<typeof Login> {
  static summary = 'Login to Apollo'
  static description =
    'Use the provided credentials to obtain and save the token to access Apollo. \
Once the token for the given profile has been saved in the configuration file, users do not normally \
need to execute this command again unless the token has expired. To setup a new profile use "apollo config"\n\n\
For login types that sign in with a browser (e.g. Google, Microsoft, or another OpenID Connect provider), \
this command prints a URL and a code. Open the URL in a browser on any computer, check that the code matches, \
and sign in. This works even when running the command on a remote server, e.g. over SSH.'

  static examples = [
    {
      description:
        'The most basic and probably most typical usage is to login using the default profile in configuration file:',
      command: '<%= config.bin %> <%= command.id %>',
    },
    {
      description: 'Login with a different profile:',
      command: '<%= config.bin %> <%= command.id %> --profile my-profile',
    },
    {
      description:
        "Print the login URL without trying to open a browser on this computer, e.g. when it's a remote server:",
      command: '<%= config.bin %> <%= command.id %> --no-browser',
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
    browser: Flags.boolean({
      description:
        'Try to open the login URL in a browser on this computer. Use --no-browser to only print the URL.',
      default: true,
      allowNo: true,
    }),
    port: Flags.integer({
      description: 'Deprecated and ignored, login no longer listens on a port',
      hidden: true,
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Login)

    if (flags.port !== undefined) {
      this.warn(
        'The --port flag is deprecated and ignored, login no longer listens on a port',
      )
    }

    const profileName = flags.profile ?? process.env.APOLLO_PROFILE ?? 'default'
    const config = this.getConfig()
    const accessType: string = config.get(`${profileName}.accessType`) as string
    const address: string =
      flags.address ?? (config.get(`${profileName}.address`) as string)
    if (address === undefined) {
      this.error('Address to apollo must be set')
    }

    let userCredentials: UserCredentials = { accessToken: '' }
    try {
      if (!flags.force) {
        await this.checkUserAlreadyLoggedIn(config, profileName)
      }
      if (accessType === 'root' || flags.username !== undefined) {
        const password: string =
          flags.password ??
          (config.get(`${profileName}.rootPassword`) as string)
        if (password === undefined) {
          this.error('Username and password must be set')
        }
        userCredentials = await this.startRootLogin(address, password)
      } else if (accessType === undefined) {
        this.error('Undefined access type')
      } else {
        const loginType = await this.getLoginType(address, accessType)
        userCredentials = loginType.needsPopup
          ? await this.startDeviceLogin(address, accessType, flags.browser)
          : await this.startDirectLogin(address, accessType)
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
    config.set(`${profileName}.accessToken`, userCredentials.accessToken)
  }

  private async checkUserAlreadyLoggedIn(
    userCredentials: ApolloConf,
    profileName: string,
  ) {
    const accessToken: string = userCredentials.get(
      `${profileName}.${KEYS.accessToken}`,
    ) as string
    if (!accessToken) {
      return
    }
    const reAuthenticate = await confirm({
      message: "You're already logged in. Do you want to re-authenticate?",
      default: true,
    })
    if (!reAuthenticate) {
      this.exit(0)
    }
  }

  private async getLoginType(
    address: string,
    accessType: string,
  ): Promise<LoginType> {
    const url = localhostToAddress(`${address}/auth/types`)
    const response = await fetch(url)
    if (!response.ok) {
      const errorMessage = await createFetchErrorMessage(
        response,
        'Getting login types failed',
      )
      throw new Error(errorMessage)
    }
    const loginTypes = (await response.json()) as LoginType[]
    const loginType = loginTypes.find(({ name }) => name === accessType)
    if (!loginType) {
      const available = ['root', ...loginTypes.map(({ name }) => name)]
      this.error(
        `Login type "${accessType}" is not available on this server. Available types are: ${available.join(', ')}. Use "apollo config" to change it.`,
      )
    }
    return loginType
  }

  private async startRootLogin(
    address: string,
    password: string,
  ): Promise<UserCredentials> {
    const url = localhostToAddress(`${address}/auth/root`)
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      body: JSON.stringify({ password }),
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

  /** Log in with a type that doesn't need a browser, e.g. guest */
  private async startDirectLogin(
    address: string,
    accessType: string,
  ): Promise<UserCredentials> {
    const url = localhostToAddress(
      `${address}/auth/login?${new URLSearchParams({ type: accessType }).toString()}`,
    )
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) {
      const errorMessage = await createFetchErrorMessage(
        response,
        `${accessType} login failed`,
      )
      throw new Error(errorMessage)
    }
    const dat = await response.json()
    if (typeof dat === 'object' && dat !== null && 'token' in dat) {
      return { accessToken: dat.token as string }
    }
    throw new Error(`Unexpected response: ${JSON.stringify(dat)}`)
  }

  /**
   * Log in with a type that needs a browser, e.g. Google. The user completes
   * the login in a browser on any computer while we wait for the token.
   */
  private async startDeviceLogin(
    address: string,
    accessType: string,
    tryBrowser: boolean,
  ): Promise<UserCredentials> {
    const response = await fetch(localhostToAddress(`${address}/auth/device`), {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      body: JSON.stringify({ type: accessType }),
    })
    if (!response.ok) {
      const errorMessage = await createFetchErrorMessage(
        response,
        'Starting login failed',
      )
      throw new Error(errorMessage)
    }
    const deviceLogin = (await response.json()) as DeviceLoginResponse

    this.logToStderr(
      `To log in, open this URL in a browser on any computer:\n\n  ${deviceLogin.verification_uri_complete}\n\nand check that it shows this code:\n\n  ${deviceLogin.user_code}\n`,
    )
    if (tryBrowser && canOpenBrowser()) {
      try {
        await open(deviceLogin.verification_uri_complete)
      } catch {
        // The URL is printed above, so the user can open it themselves
      }
    }

    ux.action.start('Waiting for login in the browser')
    const deadline = Date.now() + deviceLogin.expires_in * 1000
    let { interval } = deviceLogin
    while (Date.now() < deadline) {
      await sleep(interval * 1000)
      const result = await this.pollDeviceToken(address, deviceLogin)
      if ('token' in result) {
        ux.action.stop('done')
        return { accessToken: result.token }
      }
      if (result.error === 'slow_down') {
        interval += 5
      } else if (result.error !== 'authorization_pending') {
        break
      }
    }
    ux.action.stop('failed')
    this.error('The login code expired, run "apollo login" again')
  }

  private async pollDeviceToken(
    address: string,
    deviceLogin: DeviceLoginResponse,
  ): Promise<DeviceTokenResponse> {
    const response = await fetch(
      localhostToAddress(`${address}/auth/device/token`),
      {
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        body: JSON.stringify({ device_code: deviceLogin.device_code }),
      },
    )
    // Pending logins are reported as 400s with an error code
    if (response.ok || response.status === 400) {
      const dat = (await response.json()) as Partial<{
        token: string
        error: string
        message: string
      }>
      if (dat.token) {
        return { token: dat.token }
      }
      if (dat.error && !dat.message) {
        return { error: dat.error }
      }
    }
    const errorMessage = await createFetchErrorMessage(
      response,
      'Checking login status failed',
    )
    throw new Error(errorMessage)
  }
}

/** Whether there's likely a browser on this computer that the user can see */
function canOpenBrowser() {
  if (process.env.SSH_CONNECTION || process.env.SSH_TTY) {
    return false
  }
  if (process.platform === 'linux') {
    return Boolean(process.env.DISPLAY ?? process.env.WAYLAND_DISPLAY)
  }
  return true
}
