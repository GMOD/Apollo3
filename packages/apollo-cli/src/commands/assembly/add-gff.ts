import * as fs from 'node:fs'
import * as http from 'node:http'
import * as https from 'node:https'

import { Flags } from '@oclif/core'
import { ObjectId } from 'bson'

import { BaseCommand } from '../../baseCommand.js'
import { deleteAssembly, localhostToAddress, queryApollo, sleep } from '../../utils.js'

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

    const res = await this.submitAssembly(
      localhostToAddress(access.address),
      access.accessToken,
      flags.assembly,
      uploadId,
      typeName,
      flags.force,
    )
    if (
      res.statusCode !== undefined &&
      res.statusCode >= 200 &&
      res.statusCode <= 299
    ) {
      this.exit(0)
    } else {
      this.logToStderr(
        `Request returned with code ${res.statusCode} and message:\n${res.statusMessage}`,
      )
    }
  }

  async submitAssembly(
    address: string,
    accessToken: string,
    assemblyName: string,
    fileId: string,
    typeName: string,
    force: boolean,
  ): Promise<http.IncomingMessage> {
    const body = {
      assemblyName,
      fileId,
      typeName,
      assembly: new ObjectId().toHexString(),
    }
    // Using http.request instead of fetch to avoid timeout see
    // https://github.com/nodejs/node/issues/46375#issuecomment-1406305331
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
    const url = new URL(address)
    const auth = {
      hostname: url.hostname,
      port: url.port,
      path: '/changes',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
    let response: http.IncomingMessage | undefined = undefined
    const req = await http.request(auth, (res) => {
      response = res
    })
    req.write(JSON.stringify(body))
    req.end()
    while (response === undefined) {
      // There must be a better way to wait for response to materialize
      await sleep(1000)
    }
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
