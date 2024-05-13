import * as fs from 'node:fs'
import * as path from 'node:path'

import { Flags } from '@oclif/core'
import { ObjectId } from 'bson'

import { BaseCommand } from '../../baseCommand.js'
import { submitAssembly, uploadFile, wrapLines } from '../../utils.js'

export default class AddGff extends BaseCommand<typeof AddGff> {
  static summary = 'Add new assembly from gff or gft file'
  static description = wrapLines(
    'The gff file is expected to contain sequences as per gff specifications. Features are also imported by default.',
  )

  static examples = [
    {
      description: 'Import sequences and features:',
      command:
        '<%= config.bin %> <%= command.id %> -i genome.gff -a myAssembly',
    },
    {
      description: 'Import sequences only:',
      command:
        '<%= config.bin %> <%= command.id %> -i genome.gff -a myAssembly -o',
    },
  ]

  static flags = {
    'input-file': Flags.string({
      char: 'i',
      description: 'Input gff or gtf file',
      required: true,
    }),
    assembly: Flags.string({
      char: 'a',
      description: 'Name for this assembly. Use the file name if omitted',
    }),
    'omit-features': Flags.boolean({
      char: 'o',
      description: 'Do not import features, only upload the sequences',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Delete existing assembly, if it exists',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(AddGff)

    if (!fs.existsSync(flags['input-file'])) {
      this.logToStderr(`File ${flags['input-file']} does not exist`)
      this.exit(1)
    }

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    const fileId = await uploadFile(
      access.address,
      access.accessToken,
      flags['input-file'],
      'text/x-gff3',
    )

    let typeName = 'AddAssemblyAndFeaturesFromFileChange'
    if (flags['omit-features']) {
      typeName = 'AddAssemblyFromFileChange'
    }

    const assemblyName = flags.assembly ?? path.basename(flags['input-file'])

    let res
    try {
      const body = {
        assemblyName,
        fileId,
        typeName,
        assembly: new ObjectId().toHexString(),
      }
      res = await submitAssembly(
        access.address,
        access.accessToken,
        body,
        flags.force,
      )
    } catch (error) {
      this.logToStderr((error as Error).message)
      this.exit(1)
    }
    if (!res.ok) {
      const json = JSON.parse(await res.text())
      const message: string = json['message' as keyof typeof json]
      this.logToStderr(message)
      this.exit(1)
    }
    this.exit(0)
  }
}
