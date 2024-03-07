import * as fs from 'node:fs'

import { Flags } from '@oclif/core'
import { ObjectId } from 'bson'
// import { fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import { deleteAssembly, localhostToAddress, queryApollo } from '../../utils.js'

export default class AddGff extends BaseCommand<typeof AddGff> {
  static description = 'Add assembly sequences from gff or gft file'

  static flags = {
    'input-file': Flags.string({
      char: 'i',
      description: 'Input gff or gtf file',
      required: true,
    }),
    assembly: Flags.string({
      char: 'a',
      description: 'Name for this assembly',
      required: true,
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

    const uploadId = await uploadFile(
      access.address,
      access.accessToken,
      flags['input-file'],
    )

    let typeName = 'AddAssemblyAndFeaturesFromFileChange'
    if (flags['omit-features']) {
      typeName = 'AddAssemblyFromFileChange'
    }

    const response: Response = await this.submitAssembly(
      access.address,
      access.accessToken,
      flags.assembly,
      uploadId,
      typeName,
      flags.force
    )
    if (!response.ok) {
      const json = JSON.parse(await response.text())
      const message: string = json['message' as keyof typeof json]
      this.logToStderr(message)
      this.exit(1)
    }
  }

  async submitAssembly(
    address: string,
    accessToken: string,
    assemblyName: string,
    fileId: string,
    typeName: string,
    force: boolean,
  ): Promise<Response> {
    const body = {
      assemblyName,
      fileId,
      typeName,
      assembly: new ObjectId().toHexString(),
    }
    const assemblies = await queryApollo(address, accessToken, 'assemblies')
    for (const x of await assemblies.json()) {
      if (x['name' as keyof typeof x] === assemblyName) {
        if (force) {
          await deleteAssembly(address, accessToken, x['_id' as keyof typeof x])
        } else {
          this.logToStderr(`Error: Assembly "${assemblyName}" already exists`)
          this.exit(1)
        }
      }
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
}

async function uploadFile(
  address: string,
  accessToken: string,
  file: string,
): Promise<string> {
  const buffer: string = fs.readFileSync(file, 'utf8')
  const blob = new Blob([buffer])
  await blob.text()

  const formData = new FormData()
  formData.append('type', 'text/x-gff3')
  formData.append('file', blob)

  const auth = {
    method: 'POST',
    body: formData,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    // dispatcher: new Agent({ bodyTimeout: 24 * 60 * 60 * 1000 }),
    // signal: AbortSignal.timeout(500_000),
  }

  const url = new URL(localhostToAddress(`${address}/files`))
  try {
    const response = await fetch(url, auth)
    const json = (await response.json()) as object
    return json['_id' as keyof typeof json]
  } catch (error) {
    console.error(error)
    throw error
  }
}