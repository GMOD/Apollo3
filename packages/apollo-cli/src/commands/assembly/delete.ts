import { Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'
import {
  convertAssemblyNameToId,
  deleteAssembly,
  getAssembly,
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
    verbose: Flags.boolean({
      char: 'v',
      description: 'Print to stdout the array of assemblies deleted',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Delete)

    const access = await this.getAccess()

    const assembly: string[] = await idReader(flags.assembly)
    const deleteIds = await convertAssemblyNameToId(
      access.address,
      access.accessToken,
      assembly,
    )
    let i = 0
    const deleted: object[] = []
    for (const x of deleteIds) {
      const asm = await getAssembly(access.address, access.accessToken, x)
      await deleteAssembly(access.address, access.accessToken, x)
      deleted.push(asm)
      i += 1
    }
    if (flags.verbose) {
      this.log(JSON.stringify(deleted, null, 2))
    }
    this.logToStderr(`${i} assemblies deleted`) // Keep as logToStderr
  }
}
