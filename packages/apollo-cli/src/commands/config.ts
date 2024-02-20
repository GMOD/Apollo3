import path from 'node:path'

import input from '@inquirer/input'
import password from '@inquirer/password'
import select from '@inquirer/select'
import { Args, Flags } from '@oclif/core'

import { BaseCommand } from '../baseCommand.js'
import { Config, ConfigError, KEYS } from '../Config.js'
import { localhostToAddress } from '../utils.js'

export default class ApolloConfig extends BaseCommand<typeof ApolloConfig> {
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

  static flags = {
    profile: Flags.string({
      description: 'Profile to create or edit',
      required: false,
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
      await this.interactiveSetup(config, flags.profile)
    } else {
      let profileName = 'default'
      if (flags.profile !== undefined) {
        profileName = flags.profile
      }
      try {
        if (args.value === undefined) {
          const currentValue: string | undefined = config.get(
            args.key,
            profileName,
          )
          this.log(currentValue)
        } else {
          config.set(args.key, args.value, profileName)
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

  private async interactiveSetup(
    config: Config,
    profileName: string | undefined,
  ) {
    if (profileName === undefined) {
      profileName = await this.askProfileName(config.getProfileNames())
    }

    let setMe = true
    while (setMe) {
      const address: string = await this.askAddress(
        config.get(KEYS[KEYS.address], profileName),
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

    const address = config.get(KEYS[KEYS.address], profileName)
    let accessType = ''
    try {
      accessType = await this.selectAccessType(address)
    } catch (error) {
      if (error instanceof ConfigError) {
        this.logToStderr(error.message)
        this.exit(1)
      }
    }

    config.set(KEYS[KEYS.accessType], accessType, profileName)
    if (accessType === 'root') {
      const username: string = await this.askUsername(
        config.get(KEYS.rootCredentials_username, profileName),
      )
      config.set('rootCredentials.username', username, profileName)

      const password: string = await this.askPassword()
      config.set('rootCredentials.password', password, profileName)
    }
  }

  private async askProfileName(currentProfiles: string[]): Promise<string> {
    const newProfile = '<New profile>'
    currentProfiles.push(newProfile)
    const xchoices = []
    for (const profileName of currentProfiles) {
      xchoices.push({ name: profileName, value: profileName })
    }

    let answer = newProfile
    if (currentProfiles.length > 1) {
      answer = await select({
        message: 'Select profile to edit or create a new one:',
        choices: xchoices,
      })
    }

    if (answer === newProfile) {
      answer = await input({
        message: 'New profile name:',
        default: currentProfiles.includes('default') ? undefined : 'default',
      })
    }

    return answer
  }

  private async askPassword(): Promise<string> {
    let answer = ''
    while (answer === '') {
      answer = await password({
        message: 'Root password:',
        mask: true,
      })
      answer = answer.trim()
    }
    return answer
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
    const xchoices = [{ name: 'root', value: 'root' }]
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
      const response = await fetch(localhostToAddress(`${address}/auth/types`))
      return await response.json()
    } catch {
      throw new ConfigError(
        `Unable to retrieve login types for address: "${address}"`,
      )
    }
  }
}
