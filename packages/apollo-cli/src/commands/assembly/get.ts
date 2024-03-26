import { Flags } from '@oclif/core'
import { Response } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import { convertAssemblyNameToId, idReader, queryApollo } from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static description = 'Get available assemblies'

  static flags = {
    assembly: Flags.string({
      char: 'a',
      description: 'Get assemblies in this list of names or IDs',
      multiple: true,
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Get)

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    const assemblies: Response = await queryApollo(
      access.address,
      access.accessToken,
      'assemblies',
    )

    let assemblyIds: string[] = []
    if (flags.assembly !== undefined) {
      const assembly = idReader(flags.assembly)
      assemblyIds = await convertAssemblyNameToId(
        access.address,
        access.accessToken,
        assembly,
      )
    }

    const json = (await assemblies.json()) as object[]
    const keep = []
    for (const x of json) {
      if (
        flags.assembly === undefined ||
        assemblyIds.includes(x['_id' as keyof typeof x])
      ) {
        keep.push(x)
      }
    }
    this.log(JSON.stringify(keep, null, 2))
  }
}
