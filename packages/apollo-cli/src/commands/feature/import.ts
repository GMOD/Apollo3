import * as fs from 'node:fs'

import { Flags } from '@oclif/core'
import { Response, fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import {
  convertAssemblyNameToId,
  createFetchErrorMessage,
  localhostToAddress,
  uploadFile,
} from '../../utils.js'

export default class Import extends BaseCommand<typeof Import> {
  static summary = 'Import features from local gff file'
  static description = 'By default, features are added to the existing ones.'

  static examples = [
    {
      description:
        'Delete features in myAssembly and then import features.gff3:',
      command:
        '<%= config.bin %> <%= command.id %> -d -i features.gff3 -a myAssembly',
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
      description: 'Import into this assembly name or assembly ID',
      required: true,
    }),
    'delete-existing': Flags.boolean({
      char: 'd',
      description: 'Delete existing features before importing',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Import)

    if (!fs.existsSync(flags['input-file'])) {
      this.logToStderr(`File "${flags['input-file']}" does not exist`)
      this.exit(1)
    }

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    const assembly = await convertAssemblyNameToId(
      access.address,
      access.accessToken,
      [flags.assembly],
    )
    if (assembly.length === 0) {
      this.logToStderr(
        `Assembly "${flags.assembly}" does not exist. Perhaps you want to create this assembly first`,
      )
      this.exit(1)
    }

    const uploadId = await uploadFile(
      access.address,
      access.accessToken,
      flags['input-file'],
      'text/x-gff3',
    )

    const response: Response = await importFeatures(
      access.address,
      access.accessToken,
      assembly[0],
      uploadId,
      flags['delete-existing'],
    )

    if (!response.ok) {
      const json = JSON.parse(await response.text())
      const message: string = json['message' as keyof typeof json]
      this.logToStderr(message)
      this.exit(1)
    }
    this.exit(0)
  }
}

async function importFeatures(
  address: string,
  accessToken: string,
  assembly: string,
  fileId: string,
  deleteExistingFeatures: boolean,
): Promise<Response> {
  const body = {
    typeName: 'AddFeaturesFromFileChange',
    assembly,
    fileId,
    deleteExistingFeatures,
  }

  const controller = new AbortController()
  setTimeout(
    () => {
      controller.abort()
    },
    24 * 60 * 60 * 1000,
  )

  const auth = {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    signal: controller.signal,
  }

  const url = new URL(localhostToAddress(`${address}/changes`))
  const response = await fetch(url, auth)
  if (!response.ok) {
    const errorMessage = await createFetchErrorMessage(
      response,
      'importFeatures failed',
    )
    throw new Error(errorMessage)
  }
  return response
}
