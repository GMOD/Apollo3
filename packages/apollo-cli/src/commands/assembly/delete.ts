import { Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'
import {
  convertAssemblyNameToId,
  deleteAssembly,
  idReader,
  wrapLines,
} from '../../utils.js'

export default class Delete extends BaseCommand<typeof Delete> {
  static summary = 'Delete assemblies'
  static description = wrapLines('Assemblies to delete may be names or IDs')
  static examples = [
    {
      description: 'Delete multiple assemblies using name or ID:',
      command:
        '<%= config.bin %> <%= command.id %> -a mouse 6605826fbd0eee691f83e73f',
    },
  ]

  static flags = {
    assembly: Flags.string({
      char: 'a',
      description: 'Assembly names or IDs to delete',
      multiple: true,
      required: true,
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Delete)

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    const assembly = idReader(flags.assembly)
    const deleteIds = await convertAssemblyNameToId(
      access.address,
      access.accessToken,
      assembly,
    )
    for (const x of deleteIds) {
      await deleteAssembly(access.address, access.accessToken, x)
    }
  }
}
