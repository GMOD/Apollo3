import * as fs from 'node:fs'

import { Flags } from '@oclif/core'
import ObjectID from 'bson-objectid'

import { BaseCommand } from '../../baseCommand.js'
import { localhostToAddress } from '../../utils.js'

export default class AddGff extends BaseCommand<typeof AddGff> {
  static description = 'Add assembly sequences from gff or gft file'

  static flags = {
    'input-file': Flags.string({
      char: 'i',
      description: 'Input gff or gtf file',
      required: true,
    }),
    'assembly-name': Flags.string({
      char: 'n',
      description: 'Name for this assembly',
      required: true,
    }),
    'omit-features': Flags.boolean({
      char: 'o',
      description: 'Do not import features, only upload the sequences',
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

    const uploadId = await uploadFile(
      access.address,
      access.accessToken,
      flags['input-file'],
    )

    let typeName = 'AddAssemblyAndFeaturesFromFileChange'
    if (!flags['omit-features']) {
      typeName = 'AddAssemblyFromFileChange'
    }

    const response: Response = await submitAssembly(
      access.address,
      access.accessToken,
      flags['assembly-name'],
      uploadId,
      typeName,
    )
    if (!response.ok) {
      const json = JSON.parse(await response.text())
      const message: string = json['message' as keyof typeof json]
      this.logToStderr(message)
      this.exit(1)
    }
  }
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

async function submitAssembly(
  address: string,
  accessToken: string,
  assemblyName: string,
  fileId: string,
  typeName: string,
): Promise<Response> {
  const body = {
    assemblyName,
    fileId,
    typeName,
    assembly: new ObjectID().toHexString(),
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
