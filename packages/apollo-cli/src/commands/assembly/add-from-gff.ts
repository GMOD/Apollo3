import * as fs from 'node:fs'
import * as path from 'node:path'

import { Flags } from '@oclif/core'
import { ObjectId } from 'bson'

import { FileCommand } from '../../fileCommand.js'
import { submitAssembly, wrapLines } from '../../utils.js'

export default class AddGff extends FileCommand {
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
      description: 'Input gff file',
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
      this.error(`File ${flags['input-file']} does not exist`)
    }

    const access = await this.getAccess()

    const fileId = await this.uploadFile(
      access.address,
      access.accessToken,
      flags['input-file'],
      'text/x-gff3',
      flags['input-file'].endsWith('.gz'),
    )

    let typeName = 'AddAssemblyAndFeaturesFromFileChange'
    if (flags['omit-features']) {
      typeName = 'AddAssemblyFromFileChange'
    }

    const assemblyName = flags.assembly ?? path.basename(flags['input-file'])

    const body = {
      assemblyName,
      fileId,
      typeName,
      assembly: new ObjectId().toHexString(),
    }
    const rec = await submitAssembly(
      access.address,
      access.accessToken,
      body,
      flags.force,
    )
    this.log(JSON.stringify(rec, null, 2))
  }
}
