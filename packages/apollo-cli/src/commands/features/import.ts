import * as fs from 'node:fs'

import { Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'
import { assemblyNamesToIds, localhostToAddress } from '../../utils.js'

export default class Import extends BaseCommand<typeof Import> {
  static description = 'Import features from local gff file'

  static flags = {
    'input-file': Flags.string({
      char: 'i',
      description: 'Input gff or gtf file',
      required: true,
    }),
    'assembly': Flags.string({
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

    const nameToId = await assemblyNamesToIds(
      access.address,
      access.accessToken,
    )
    let assembly = ''
    if (nameToId[flags.assembly] !== undefined) {
      assembly = nameToId[flags.assembly]
    } else if (!Object.values(nameToId).includes(flags.assembly)) {
      this.logToStderr(
        `Assembly "${flags.assembly}" does not exist. Perhaps you want to create this assembly first`,
      )
      this.exit(1)
    }

    const uploadId = await uploadFile(
      access.address,
      access.accessToken,
      flags['input-file'],
    )

    const response: Response = await importFeatures(
      access.address,
      access.accessToken,
      assembly,
      uploadId,
      flags['delete-existing'],
    )

    if (!response.ok) {
      const json = JSON.parse(await response.text())
      const message: string = json['message' as keyof typeof json]
      this.logToStderr(message)
      this.exit(1)
    }
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

  const auth = {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  }

  const url = new URL(localhostToAddress(`${address}/changes`))
  const response = await fetch(url, auth)
  return response
}

async function uploadFile(
  address: string,
  accessToken: string,
  file: string,
): Promise<string> {
  const buffer: Buffer = fs.readFileSync(file)
  const blob = new Blob([buffer])

  const formData = new FormData()
  formData.append('type', 'text/x-gff3')
  formData.append('file', blob)

  const auth = {
    method: 'POST',
    body: formData,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }

  const url = new URL(localhostToAddress(`${address}/files`))
  try {
    const response = await fetch(url, auth)
    const json = await response.json()
    return json['_id' as typeof json]
  } catch (error) {
    console.error(error)
    throw error
  }
}
