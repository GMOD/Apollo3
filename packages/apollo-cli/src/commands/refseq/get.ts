import { Flags } from '@oclif/core'
import { Response } from 'node-fetch'

import { BaseCommand } from '../../baseCommand.js'
import { convertAssemblyNameToId, idReader, queryApollo } from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static description = 'Get available reference sequences'
  static flags = {
    assembly: Flags.string({
      char: 'a',
      multiple: true,
      description:
        'Get reference sequences for these assembly names or IDs; use - to read it from stdin',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Get)

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    const refSeqs: Response = await queryApollo(
      access.address,
      access.accessToken,
      'refSeqs',
    )
    const json = (await refSeqs.json()) as object[]

    let keep = json
    if (flags.assembly !== undefined) {
      keep = []
      const assembly = idReader(flags.assembly)
      const assemblyIds = await convertAssemblyNameToId(
        access.address,
        access.accessToken,
        assembly,
      )
      for (const x of json) {
        if (assemblyIds.includes(x['assembly' as keyof typeof x])) {
          keep.push(x)
        }
      }
    }
    this.log(JSON.stringify(keep, null, 2))
  }
}
