import { Flags } from '@oclif/core'
import { ObjectId } from 'bson'

import { BaseCommand } from '../../baseCommand.js'
import { idReader, submitAssembly } from '../../utils.js'

export default class AddFile extends BaseCommand<typeof AddFile> {
  static summary = 'Add new assembly from an uploaded file'
  static description =
    'Use the file id of a previously uploaded file to add a new assembly.\
    \n\n\
    For uploading a new file see `apollo file upload`\
    \n\
    For getting the file id of an uploaded file see `apollo file get`\
    \n\
    For uploading & adding in a single pass see `apollo assembly add-*`'

  static examples = [
    {
      description: 'Use file id xyz to add assembly "myAssembly":',
      command: '<%= config.bin %> <%= command.id %> -i xyz -a myAssembly',
    },
  ]

  static flags = {
    'file-id': Flags.string({
      char: 'i',
      description: 'ID of file to upload',
      default: '-',
    }),
    assembly: Flags.string({
      char: 'a',
      description: 'Name for this assembly. If omitted use the file id',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Delete existing assembly, if it exists',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(AddFile)

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    const assemblyName = flags.assembly ?? flags['file-id']

    const fid = idReader([flags['file-id']])

    const body = {
      assemblyName,
      fileId: fid[0],
      typeName: 'AddAssemblyFromFileChange',
      assembly: new ObjectId().toHexString(),
    }

    const rec = await submitAssembly(
      access.address,
      access.accessToken,
      body,
      flags.force,
    )
    this.log(JSON.stringify(rec, null, 2))
    this.exit(0)
  }
}
