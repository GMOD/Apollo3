import path from 'node:path'

import input from '@inquirer/input'
import password from '@inquirer/password'
import select from '@inquirer/select'
import { Args, Command, Flags } from '@oclif/core'

import { Config } from '../Config.ts'
import { ConfigError } from '../utils.ts'

export default class ApolloConfig extends Command {
  static description = 'Get or set Apollo configuration options'

  static flags = {
    profile: Flags.string({
      char: 'p',
      description: 'Set or get configuration for this profile',
      default: 'default',
    }),
    'config-file': Flags.string({
      char: 'c',
      description: 'Use this config file (mostly for testing)',
    }),
  }

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
    const { flags } = await this.parse(ApolloConfig)

    let configFile = flags['config-file']
    if (configFile === undefined) {
      configFile = path.join(this.config.configDir, 'config.yaml')
    }

    const config: Config = new Config(configFile)

    if (args.key === undefined) {
      await this.interactiveSetup(config)
    } else {
      try {
        if (args.value === undefined) {
          const currentValue: string | undefined = config.get(
            args.key,
            flags.profile,
          )
          this.log(currentValue)
        } else {
          config.set(args.key, args.value, flags.profile)
        }
      } catch (error) {
        if (error instanceof Error) {
          this.logToStderr(error.message)
        }
        this.exit(1)
      }
    }

    const v = config.validate().error?.message
    if (v) {
      this.logToStderr(v)
    }

    config.writeConfigFile()
  }

  private async interactiveSetup(config: Config) {
    const profileName: string = await this.askProfileName(
      config.getProfileNames(),
    )

    let setMe = true
    while (setMe) {
      const address: string = await this.askAddress(
        config.get('address', profileName),
      )
      try {
        config.set('address', address, profileName)
        setMe = false
      } catch (error) {
        if (error instanceof ConfigError) {
          this.logToStderr(error.message)
        }
      }
    }

    const address = config.get('address', profileName)
    if (address) {
      let accessType
      try {
        accessType = await this.selectAccessType(address)
      } catch (error) {
        if (error instanceof ConfigError) {
          this.logToStderr(error.message)
          this.exit(1)
        }
      }
      if (accessType && ['microsoft', 'google', 'guest'].includes(accessType)) {
        config.set('accessType', accessType, profileName)
      }
    }

    const username: string = await this.askUsername(
      config.get('rootCredentials.username', profileName),
    )
    config.set('rootCredentials.username', username, profileName)

    const password: string = await this.askPassword()
    config.set('rootCredentials.password', password, profileName)
  }

  private async askProfileName(currentProfiles: string[]): Promise<string> {
    currentProfiles.push('<New profile>')
    const xchoices = []
    for (const profileName of currentProfiles) {
      xchoices.push({ name: profileName, value: profileName })
    }

    let answer = await select({
      message: 'Select profile to edit or create a new one:',
      choices: xchoices,
    })

    if (answer === '<New profile>') {
      answer = await input({
        message: 'New profile name:',
        default: currentProfiles.includes('default') ? undefined : 'default',
      })
    }

    return answer
  }

  private async askPassword(): Promise<string> {
    const answer = await password({
      message: 'Root password:',
      mask: true,
    })
    return answer.trim()
  }

  private async askUsername(
    currentUsername: string | undefined,
  ): Promise<string> {
    if (currentUsername === undefined || currentUsername.trim() === '') {
      currentUsername = 'root'
    }
    const answer = await input({
      message: 'Root username:',
      default: currentUsername,
    })
    return answer.trim()
  }

  private async askAddress(
    currentAddress: string | undefined,
  ): Promise<string> {
    if (currentAddress === '' || currentAddress === undefined) {
      currentAddress = 'http://localhost:3999'
    }
    const answer = await input({
      message: 'Server address and port:',
      default: currentAddress,
    })
    return answer.trim()
  }

  private async selectAccessType(address: string): Promise<string> {
    const xchoices = []
    const types: string[] = await this.getLoginTypes(address)
    for (const type of types) {
      xchoices.push({ name: type, value: type })
    }
    const answer = await select({
      message: 'Select login type',
      choices: xchoices,
    })
    return answer
  }

  private async getLoginTypes(address: string): Promise<string[]> {
    try {
      const response = await fetch(`${address}/auth/types`)
      return await response.json()
    } catch {
      throw new ConfigError(
        `Unable to retrieve login types for address: "${address}"`,
      )
    }
  }
}
