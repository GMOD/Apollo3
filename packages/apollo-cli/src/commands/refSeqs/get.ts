import path from 'node:path'

import { Flags } from '@oclif/core'
import { BaseCommand } from '../../baseCommand.ts'
import { Config } from '../../Config.ts'

export default class Get extends BaseCommand<typeof Get> {
  static description = 'Get reference sequences in an assembly'

  static flags = {
    names: Flags.string({
      char: 'n',
      description: 'Get assemblies in this list of names',
      multiple: true,
    }),
  }

  public async run(): Promise<void> {
    const { args } = await this.parse(Get)
    const { flags } = await this.parse(Get)

    const configFile = path.join(this.config.configDir, 'config.yaml')
    const config: Config = new Config(configFile)
    const address: string | undefined = config.get('address', flags.profile)
    const token: string | undefined = config.get('accessType', flags.profile)
    
    if (address === undefined || token === undefined) {
      // handle this
    } else {
      const refSeqs: string[] = await this.getRefSeqs(address, token)
      console.log(JSON.stringify(refSeqs, null, 2))
    }
  }

  private async getRefSeqs(address: string, token: string): Promise<string[]> {
    const url = new URL(`${address}/refSeqs`)

    token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IkRhcmlvIEJlcmFsZGkiLCJlbWFpbCI6ImRhcmlvLmJlcmFsZGlAZ21haWwuY29tIiwicm9sZSI6ImFkbWluIiwiaWQiOiI2NTUzN2I1OWNiYmYxN2FjZGI2NWU5MWMiLCJpYXQiOjE3MDY2OTk4ODMsImV4cCI6MTcwNjc4NjI4M30.GBObxPbvySfA1bKkmkrRQ5ag3-6ffKS4qlAewPkCzxU'

    const auth = {
      "headers": {
        "authorization": `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
    try {
      const response = await fetch(url, auth)
      return response.json()
    } catch {
      throw new Error(
        'Unable to get assemblies..',
      )
    }
  }
}
