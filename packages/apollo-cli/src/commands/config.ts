/* eslint-disable @typescript-eslint/no-unsafe-return */
import path from 'node:path'

import input from '@inquirer/input'
import password from '@inquirer/password'
import select from '@inquirer/select'
import { Args, Flags } from '@oclif/core'
import { fetch } from 'undici'

import { ApolloConf, KEYS, optionDesc } from '../ApolloConf.js'
import { BaseCommand } from '../baseCommand.js'
import { createFetchErrorMessage, localhostToAddress } from '../utils.js'

export default class ApolloConfig extends BaseCommand<typeof ApolloConfig> {
  static summary = 'Get or set apollo configuration options'
  static description = `Use this command to create or edit a user profile with credentials to access Apollo. Configuration options are:

     ${optionDesc().join('\n\n')}`

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
    'get-config-file': Flags.boolean({
      description:
        'Return the path to the config file and exit (this file may not exist yet)',
    }),
  }

  static examples = [
    {
      description: 'Interactive setup:',
      command: '<%= config.bin %> <%= command.id %>',
    },
    {
      description: 'Setup with key/value pairs:',
      command:
        '<%= config.bin %> <%= command.id %> --profile admin address http://localhost:3999',
    },
    {
      description: 'Get current address for default profile:',
      command: '<%= config.bin %> <%= command.id %> address',
    },
  ]

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ApolloConfig)

    let configFile = flags['config-file']
    configFile =
      configFile === undefined
        ? path.join(this.config.configDir, 'config.yml')
        : path.resolve(configFile)
    if (flags['get-config-file']) {
      this.log(configFile)
      return
    }

    const config: ApolloConf = new ApolloConf(configFile)

    if (args.key === undefined) {
      await this.interactiveSetup(config, flags.profile)
    } else {
      let profileName = flags.profile
      if (profileName === undefined) {
        profileName = process.env.APOLLO_PROFILE ?? 'default'
      }
      if (flags.profile !== undefined) {
        profileName = flags.profile
      }
      if (args.value === undefined) {
        const currentValue: string = config.get(
          `${profileName}.${args.key}`,
        ) as string
        this.log(currentValue)
        return
      }
      if (args.key === 'accessType') {
        config.setAccessType(profileName, args.value)
      } else {
        config.set(`${profileName}.${args.key}`, args.value)
      }
    }
  }

  private async interactiveSetup(
    config: ApolloConf,
    profileName: string | undefined,
  ) {
    if (profileName === undefined) {
      profileName = await this.askProfileName(config.getProfileNames())
    }

    let setMe = true
    while (setMe) {
      const address: string = await this.askAddress(
        config.get(`${profileName}.${KEYS[KEYS.address]}`) as string,
      )
      config.set(`${profileName}.${KEYS[KEYS.address]}`, address)
      setMe = false
    }
    const address: string = config.get(
      `${profileName}.${KEYS[KEYS.address]}`,
    ) as string
    let accessType = ''
    accessType = await this.selectAccessType(address)

    config.setAccessType(profileName, accessType)
    if (accessType === 'root') {
      const username: string = await this.askUsername(
        config.get(`${profileName}.${KEYS.rootCredentials_username}`) as string,
      )
      config.set(`${profileName}.rootCredentials.username`, username)
      const password: string = await this.askPassword()
      config.set(`${profileName}.rootCredentials.password`, password)
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
    const response = await fetch(localhostToAddress(`${address}/auth/types`))
    if (!response.ok) {
      const errorMessage = await createFetchErrorMessage(
        response,
        `Unable to retrieve login types for address: "${address}"\n`,
      )
      throw new Error(errorMessage)
    }
    const dat = await response.json()
    if (Array.isArray(dat)) {
      return dat
    }
    throw new Error(`Unexpected object: ${JSON.stringify(dat)}`)
  }
}
