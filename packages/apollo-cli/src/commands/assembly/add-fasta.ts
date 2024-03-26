import * as fs from 'node:fs'

import { Flags } from '@oclif/core'
import { ObjectId } from 'bson'
import { Response } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import { submitAssembly, uploadFile } from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static description =
    'Add assembly sequences from local fasta file or external source'

  static flags = {
    'input-file': Flags.string({
      char: 'i',
      description: 'Input fasta file',
      required: true,
    }),
    assembly: Flags.string({
      char: 'a',
      description: 'Name for this assembly',
      required: true,
    }),
    index: Flags.string({
      char: 'x',
      description: 'URL of the index. Ignored if input is a local file',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Delete existing assembly, if it exists',
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
      const body = {
        assemblyName: flags.assembly,
        typeName: 'AddAssemblyFromExternalChange',
        externalLocation: {
          fa: flags['input-file'],
          fai: flags.index,
        },
      }
      response = (await submitAssembly(
        access.address,
        access.accessToken,
        body,
        flags.force,
      )) as unknown as Response
    } else {
      if (!isExternal && !fs.existsSync(flags['input-file'])) {
        this.logToStderr(`File ${flags['input-file']} does not exist`)
        this.exit(1)
      }
      try {
        const fileId = await uploadFile(
          access.address,
          access.accessToken,
          flags['input-file'],
          'text/x-fasta',
        )
        const body = {
          assemblyName: flags.assembly,
          fileId,
          typeName: 'AddAssemblyFromFileChange',
          assembly: new ObjectId().toHexString(),
        }
        response = (await submitAssembly(
          access.address,
          access.accessToken,
          body,
          flags.force,
        )) as unknown as Response
      } catch (error) {
        this.logToStderr((error as Error).message)
        this.exit(1)
      }
    }
    if (!response.ok) {
      const json = JSON.parse(await response.text())
      this.logToStderr(JSON.stringify(json, null, 2))
      this.exit(1)
    }
    this.exit(0)
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
