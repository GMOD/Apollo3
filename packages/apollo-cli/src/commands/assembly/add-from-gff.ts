import * as fs from 'node:fs'
import path from 'node:path'

import {
  type SerializedAddAssemblyAndFeaturesFromFileChange,
  type SerializedAddAssemblyFromExternalChange,
  type SerializedAddAssemblyFromFileChange,
} from '@apollo-annotation/shared'
import { Args, Flags } from '@oclif/core'
import { ObjectId } from 'bson'

import { FileCommand } from '../../fileCommand.js'
import { submitAssembly } from '../../utils.js'

export default class AddGff extends FileCommand {
  static summary = 'Add new assembly from gff or gft file'
  static description =
    'The gff file is expected to contain sequences as per gff specifications. Features are also imported by default.'

  static examples = [
    {
      description: 'Import sequences and features:',
      command: '<%= config.bin %> <%= command.id %> genome.gff -a myAssembly',
    },
    {
      description: 'Import sequences only:',
      command:
        '<%= config.bin %> <%= command.id %> genome.gff -a myAssembly -o',
    },
  ]

  static args = {
    'input-file': Args.string({
      description: 'Input gff file',
      required: true,
    }),
  }

  static flags = {
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
    const { args, flags } = await this.parse(AddGff)

    if (!fs.existsSync(args['input-file'])) {
      this.error(`File ${args['input-file']} does not exist`)
    }

    const access = await this.getAccess()

    const fileId = await this.uploadFile(
      access.address,
      access.accessToken,
      args['input-file'],
      'text/x-gff3',
      args['input-file'].endsWith('.gz'),
    )

    const assemblyName = flags.assembly ?? path.basename(args['input-file'])

    const body:
      | SerializedAddAssemblyFromFileChange
      | SerializedAddAssemblyFromExternalChange
      | SerializedAddAssemblyAndFeaturesFromFileChange = flags['omit-features']
      ? {
          assemblyName,
          fileIds: { fa: fileId },
          typeName: 'AddAssemblyFromFileChange',
          assembly: new ObjectId().toHexString(),
        }
      : {
          assemblyName,
          fileIds: { fa: fileId },
          typeName: 'AddAssemblyAndFeaturesFromFileChange',
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
