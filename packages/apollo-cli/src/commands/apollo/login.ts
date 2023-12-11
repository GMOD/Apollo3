import * as http from 'node:http'
import * as querystring from 'node:querystring'
import * as path from 'path'
import * as fs from 'node:fs'
const yaml = require('js-yaml');

import { CliUx, Command, Flags } from '@oclif/core'
import { CLIError, ExitError } from '@oclif/core/lib/errors'

import { KeycloakService } from '../../services/keycloak.service'
import {
  LoginError,
  UserCredentials,
  getUserCredentials,
  saveUserCredentials,
  waitFor,
} from '../../utils'

import EventEmitter = require('node:events')
import { Config, LoginConfig } from '../../config';

interface AuthorizationCodeCallbackParams {
  access_token: string
}

const apolloAddress = 'http://localhost:3999'

export default class ApolloLogin extends Command {
  static description = 'Login to Apollo'
  static flags = {
    address: Flags.string({
      char: 'a',
      description: `Address of Apollo server [${apolloAddress}]`,
      default: undefined,
      required: false,
    }),
    username: Flags.string({
      char: 'u',
      description: 'Username',
      default: undefined,
      required: false,
    }),
    password: Flags.string({
      char: 'p',
      description: 'Password',
      default: undefined,
      required: false,
    }),
    "root-login": Flags.boolean({
      char: 'r',
      description: 'Login as root using configured credentials',
    }),
  }

  keycloakService = new KeycloakService()

  public async run(): Promise<void> {

    const { flags } = await this.parse(ApolloLogin)
    try {
      await this.checkUserAlreadyLoggedIn()

      let userCredentials: UserCredentials = {
        accessToken: '',
        refreshToken: '',
      }

      let config: Config = new Config()
      // if (fs.existsSync(CONFIG_FILE)) {
      //   config = new Config(CONFIG_FILE)
      // }
      const loginConfig: LoginConfig = config.login
      
      for (const key of Object.keys(loginConfig)) {
        if (flags[key] !== undefined) {
          // If given, command arguments override config file
          loginConfig[key as keyof LoginConfig] = flags[key]
        }
      }

      if(flags['root-login']) {
        for (const key of Object.keys(loginConfig)) {
          if(loginConfig[key as keyof LoginConfig] === undefined) {
            throw new LoginError(`Failed to login: Provide a "${key}" via command line flags or configuration file\nTo setup the configuration run "apollo config"`)
          }
        }
      }

      if(loginConfig.address === undefined) {
        loginConfig.address = apolloAddress
      }
      
      if (loginConfig.username && loginConfig.password) {
        userCredentials = await this.startRootLogin(loginConfig.address, loginConfig.username, loginConfig.password)
      } else {
        userCredentials = await this.startAuthorizationCodeFlow(loginConfig.address)
        CliUx.ux.action.stop('done ✅')
      }
      saveUserCredentials(userCredentials)
      this.log('Login complete')
 
      // For testing --->
      // const response = await fetch(`${loginConfig.address}/assemblies`, {
      //   headers: { Authorization: `Bearer ${userCredentials.accessToken}` },
      // })
      // console.log(await response.json())
      // <---

    } catch (error) {
      if (error instanceof LoginError) {
        this.logToStderr(`${error.message}`)
        this.exit(2)
      } else if (
        (error instanceof CLIError && error.message === 'ctrl-c') ||
        error instanceof ExitError
      ) {
        this.exit(0)
      } else if (error instanceof Error) {
        this.logToStderr(`${error.message}`)
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
    let response = undefined
    try {
      response = await fetch(url, {
        headers: new Headers({ 'Content-Type': 'application/json' }),
        method: 'POST',
        body: JSON.stringify({ username: username, password: password }),
      })
    } catch(error) {
        throw new LoginError(`Failed to login with error: "${(error as Error).message}". Perhaps login address is invalid.`)
    }
    if(! response.ok) {
      throw new LoginError(`Failed to login (status: ${response.status}). Perhaps username or password are invalid.`)
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

    // await CliUx.ux.anykey('Press any key to open Keycloak in your browser')

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
