import path from 'node:path'

import { Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'
import { Config } from '../../Config.js'
import { ConfigError, basicCheckConfig, getAccess } from '../../utils.js'
import { string } from 'joi'

export default class Get extends BaseCommand<typeof Get> {
  static description = 'Get available assemblies'

  static flags = {
    names: Flags.string({
      char: 'n',
      description: 'Get assemblies in this list of names',
      multiple: true,
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Get)

    let configFile: string | undefined = flags['config-file']
    if (configFile === undefined) {
      configFile = path.join(this.config.configDir, 'config.yaml')
    }

    let access: { address: string; accessToken: string }
    try {
      access = await getAccess(configFile, flags.profile)
    } catch (error) {
      if (error instanceof Error) {
        this.logToStderr(error.message)
        throw error
      }
      this.exit(1)
    }
    console.log(access)

  //   try {
  //     basicCheckConfig(configFile, flags.profile)
  //   } catch (error) {
  //     if (error instanceof ConfigError) {
  //       this.logToStderr(error.message)
  //       this.exit(1)
  //     }
  //   }
  //   const config: Config = new Config(configFile)
  //   const address: string | undefined = config.get('address', flags.profile)
  //   const accessToken: string | undefined = config.get('accessToken', flags.profile)

  //   if (address === undefined || accessToken === undefined) {
  //     // handle this
  //   } else {
  //     const assemblies: string[] = await this.getAssembly(address, token)
  //     this.log(JSON.stringify(assemblies, null, 2))
  //   }
  // }

  // private async getAssembly(address: string, token: string): Promise<string[]> {
  //   const url = new URL(`${address}/assemblies`)

  //   token =
  //     'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IkRhcmlvIEJlcmFsZGkiLCJlbWFpbCI6ImRhcmlvLmJlcmFsZGlAZ21haWwuY29tIiwicm9sZSI6ImFkbWluIiwiaWQiOiI2NTUzN2I1OWNiYmYxN2FjZGI2NWU5MWMiLCJpYXQiOjE3MDY2OTk4ODMsImV4cCI6MTcwNjc4NjI4M30.GBObxPbvySfA1bKkmkrRQ5ag3-6ffKS4qlAewPkCzxU'

  //   const auth = {
  //     headers: {
  //       authorization: `Bearer ${token}`,
  //       'Content-Type': 'application/json',
  //     },
  //   }
  //   try {
  //     const response = await fetch(url, auth)
  //     return await response.json()
  //   } catch {
  //     throw new Error('Unable to get assemblies..')
  //   }
  }
}
