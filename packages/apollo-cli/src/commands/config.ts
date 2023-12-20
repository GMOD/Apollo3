import path from 'node:path'

import { Args, Command, ux } from '@oclif/core'
import input from '@inquirer/input'
import password from '@inquirer/password';
import select from '@inquirer/select'

import { Config } from '../Config.js'
import { ConfigError } from '../utils.js'

export default class ApolloConfig extends Command {
  static description = 'Get or set Apollo configuration options'
  static args = {
    key: Args.string({
      name: 'key',
      description: 'Name of configuration parameter',
    }),
    value: Args.string({
      name: 'value',
      description: 'Parameter value',
    }),
  }

  public async run(): Promise<void> {
    const { args } = await this.parse(ApolloConfig)

    const config: Config = new Config(
      path.join(this.config.configDir, 'config.yaml'),
    )

    if (args.key === undefined) {
      await this.interactiveSetup(config)
    } else {
      try {
        const currentValue = config.get(args.key)
        if (args.value === undefined) {
          this.log(currentValue)
        } else {
          config.set(args.key, args.value)
          config.writeConfigFile()
        }
      } catch (error) {
        if (error instanceof Error) {
          this.logToStderr(error.message)
        }
        this.exit(1)
      }
    }
  }

  private async interactiveSetup(config: Config) {
    const address: string = await this.askAddress(config)
    config.set('address', address)

    let loginType
    try {
      loginType = await this.selectLoginType(config)
    } catch (error) {
      if (error instanceof ConfigError) {
        this.logToStderr(error.message)
        this.exit(1)
      }
    }

    if (loginType && ['microsoft', 'google'].includes(loginType)) {
      const token: string = await this.askToken(loginType)
      config.set(loginType, token)
    } else if (loginType === 'guest') {
      const username = await this.askUsername(config)
      config.set('username', username)

      const password = await this.askPassword()
      config.set('password', password)
    }

    config.writeConfigFile()
  }

  private async askPassword(): Promise<string> {
    const answer = await password({
      message: 'Password: ',
      mask: true,
    })
    return answer.trim()
  }

  private async askUsername(config: Config): Promise<string> {
    const answer = await input({
      message: 'Username: ',
      default: config.get('username'),
    })
    return answer.trim()
  }

  private async askToken(loginType: string): Promise<string> {
    const answer = await input({
      message: `Paste your ${loginType} account token: `,
    })
    return answer.trim()
  }

  private async askAddress(config: Config): Promise<string> {
    const current: string = config.get('address')
    const answer = await input({
      message: 'Server address and port, e.g. http://localhost:3999: ',
      default: current,
    })
    return answer.trim()
  }

  private async selectLoginType(config: Config): Promise<string> {
    const xchoices = []
    const types: string[] = await this.getLoginTypes(config)
    for (const type of types) {
      xchoices.push({ name: type, value: type })
    }
    const answer = await select({
      message: 'Select login type',
      choices: xchoices,
    })
    return answer
  }

  private async getLoginTypes(config: Config): Promise<string[]> {
    const address: string = config.get('address')
    try {
      const response = await fetch(`${address}/auth/types`)
      return await response.json()
    } catch {
      throw new ConfigError(`Unable to retrieve login types for address: "${address}"`)
    }
  }
}
