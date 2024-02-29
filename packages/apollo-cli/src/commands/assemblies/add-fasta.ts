import * as fs from 'node:fs'

import { Flags } from '@oclif/core'
import { ObjectId } from 'bson'

import { BaseCommand } from '../../baseCommand.js'
import { localhostToAddress } from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static description =
    'Add assembly sequences from local fasta file or external source'

  static flags = {
    'input-file': Flags.string({
      char: 'i',
      description: 'Input fasta file',
      required: true,
    }),
    'assembly-name': Flags.string({
      char: 'n',
      description: 'Name for this assembly',
      required: true,
    }),
    index: Flags.string({
      char: 'x',
      description: 'URL of the index. Ignored if input is a local file',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Get)

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    const isExternal = isValidHttpUrl(flags['input-file'])
    let response: Response
    if (isExternal) {
      if (flags.index === undefined) {
        this.logToStderr(
          'Please provide the URL to the index of the external fasta file',
        )
        this.exit(1)
      }
      response = await addAssemblyFromExternal(
        access.address,
        access.accessToken,
        flags['assembly-name'],
        flags['input-file'],
        flags.index,
      )
    } else {
      if (!isExternal && !fs.existsSync(flags['input-file'])) {
        this.logToStderr(`File ${flags['input-file']} does not exist`)
        this.exit(1)
      }

      const uploadId = await uploadFile(
        access.address,
        access.accessToken,
        flags['input-file'],
      )

      response = await submitAssembly(
        access.address,
        access.accessToken,
        flags['assembly-name'],
        uploadId,
      )
    }
    if (!response.ok) {
      const json = JSON.parse(await response.text())
      const message: string = json['message' as keyof typeof json]
      this.logToStderr(message)
      this.exit(1)
    }
  }
}

function isValidHttpUrl(x: string) {
  let url
  try {
    url = new URL(x)
  } catch {
    return false
  }
  return url.protocol === 'http:' || url.protocol === 'https:'
}

async function uploadFile(
  address: string,
  accessToken: string,
  file: string,
): Promise<string> {
  const buffer: Buffer =
    file === '-' ? fs.readFileSync(process.stdin.fd) : fs.readFileSync(file)
  const blob = new Blob([buffer])
  
  const formData = new FormData()
  formData.append('type', 'text/x-fasta')
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

async function addAssemblyFromExternal(
  address: string,
  accessToken: string,
  assemblyName: string,
  fa: string,
  fai: string,
) {
  const body = {
    typeName: 'AddAssemblyFromExternalChange',
    assembly: new ObjectId().toHexString(),
    assemblyName,
    externalLocation: {
      fa,
      fai,
    },
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

async function submitAssembly(
  address: string,
  accessToken: string,
  assemblyName: string,
  fileId: string,
): Promise<Response> {
  const body = {
    typeName: 'AddAssemblyFromFileChange',
    assembly: new ObjectId().toHexString(),
    assemblyName,
    fileId,
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

// x = {
//   typeName: 'AddAssemblyFromExternalChange',
//   assembly: '65d8b6968872ed560aa41ef0',
//   assemblyName: 'vv',
//   externalLocation: {
//     fa: 'https://raw.githubusercontent.com/GMOD/Apollo3/main/packages/apollo-collaboration-server/test/data/volvox.fa',
//     fai: 'https://raw.githubusercontent.com/GMOD/Apollo3/main/packages/apollo-collaboration-server/test/data/volvox.fa.fai',
//   },
// }
