import { Flags } from '@oclif/core'
import { Response } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import {
  convertAssemblyNameToId,
  idReader,
  queryApollo,
  wrapLines,
} from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static summary = 'Get reference sequences'
  static description = wrapLines(
    'Output the reference sequences in one or more assemblies in json format. \
    This command returns the sequence characteristics (e.g., name, ID, etc), not the DNA sequences. \
    Use `assembly sequence` for that.',
  )

  static examples = [
    {
      description: wrapLines('All sequences in the database:'),
      command: '<%= config.bin %> <%= command.id %>',
    },
    {
      description: wrapLines('Only sequences for these assemblies:'),
      command: '<%= config.bin %> <%= command.id %> -a mm9 mm10',
    },
  ]

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

    const access = await this.getAccess()

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
