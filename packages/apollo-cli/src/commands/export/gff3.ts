import { Readable } from 'node:stream'

import { Args, Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'
import { idReader } from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static description =
    'Export the annotations for an assembly to stdout as gff3'

  static examples = [
    {
      description: 'Export annotations for myAssembly:',
      command: '<%= config.bin %> <%= command.id %> myAssembly > out.gff3',
    },
  ]

  static args = {
    assembly: Args.string({
      description: 'Export annotations for this assembly name or id',
      required: true,
    }),
  }

  static flags = {
    'include-fasta': Flags.boolean({
      description: 'Include fasta sequence in output',
      default: false,
    }),
  }

  public async run(): Promise<void> {
    const { args } = await this.parse(Get)

    const assembly = await idReader([args.assembly])
    const [assemblyId] = await this.convertAssemblyNameToId(assembly)
    if (!assemblyId) {
      this.error(`Invalid assembly name or id: ${args.assembly}`)
    }

    const searchParams = new URLSearchParams({
      assembly: assemblyId,
    })
    const { exportID } = (await this.get(
      `export/getID?${searchParams.toString()}`,
    )) as { exportID: string }

    const params: Record<string, string> = {
      exportID,
      assemblyId,
      includeFASTA: this.flags['include-fasta'] ? 'true' : 'false',
    }
    const exportSearchParams = new URLSearchParams(params)

    const responseExport = await this.fetch(
      `export?${exportSearchParams.toString()}`,
    )
    const { body } = responseExport
    if (body) {
      const readable = Readable.from(body)
      readable.pipe(process.stdout)
    } else {
      this.error('Failed to export gff3')
    }
  }
}
