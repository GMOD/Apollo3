import path from 'node:path'

import { Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'

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

    const access = await this.getAccess(flags['config-file'], flags.profile)
    // let access: { address: string; accessToken: string }
    // try {
    //   access = await getAccess(configFile, flags.profile)
    // } catch (error) {
    //   if (error instanceof Error) {
    //     this.logToStderr(error.message)
    //   }
    //   this.exit(1)
    // }
    console.log(access)

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
