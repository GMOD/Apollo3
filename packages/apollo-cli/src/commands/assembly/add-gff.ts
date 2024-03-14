import * as fs from 'node:fs'

import { Flags } from '@oclif/core'
import { ObjectId } from 'bson'
import nodeFetch, { Response } from 'node-fetch'

import { BaseCommand } from '../../baseCommand.js'
import {
  deleteAssembly,
  localhostToAddress,
  queryApollo,
  uploadFile,
} from '../../utils.js'

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
      'text/x-gff3',
    )

    let typeName = 'AddAssemblyAndFeaturesFromFileChange'
    if (flags['omit-features']) {
      typeName = 'AddAssemblyFromFileChange'
    }

    const res = await this.submitAssembly(
      localhostToAddress(access.address),
      access.accessToken,
      flags.assembly,
      uploadId,
      typeName,
      flags.force,
    )
    const out = JSON.stringify(await res.json(), null, 2)
    if (!res.ok) {
      this.logToStderr(`Failed with ${out}`)
      this.exit(1)
    }

    const assemblies = await queryApollo(
      access.address,
      access.accessToken,
      'assemblies',
    )
    for (const x of await assemblies.json()) {
      if (x['name' as keyof typeof x] === flags.assembly) {
        this.log(JSON.stringify(x, null, 2))
      }
    }
    this.exit(0)
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
    const response = await nodeFetch(url, auth)
    return response
  }
}
