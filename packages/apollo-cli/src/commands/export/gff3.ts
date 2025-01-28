import { Args, Flags } from '@oclif/core'
import { fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import {
  convertAssemblyNameToId,
  createFetchErrorMessage,
  idReader,
  localhostToAddress,
} from '../../utils.js'

import { Readable } from 'node:stream'

export default class Get extends BaseCommand<typeof Get> {
  static description = 'Export the annotation of an assembly to stdout as gff3'

  static examples = [
    {
      description: 'Export annotation for myAssembly:',
      command: '<%= config.bin %> <%= command.id %> myAssembly > out.gff3',
    },
  ]

  static args = {
    assembly: Args.string({
      description: 'Export features for this assembly name or id',
      required: true,
    }),
  }

  static flags = {
    'with-fasta': Flags.boolean({
      description: 'Append fasta sequence to output',
      default: false,
    }),
  }

  public async run(): Promise<void> {
    const { args } = await this.parse(Get)

    const access = await this.getAccess()

    const assembly = await idReader([args.assembly])
    const [assemblyId] = await convertAssemblyNameToId(
      access.address,
      access.accessToken,
      assembly,
    )
    if (!assemblyId) {
      this.error(`Invalid assembly name or id: ${args.assembly}`)
    }

    const url = new URL(localhostToAddress(`${access.address}/export/getID`))
    const searchParams = new URLSearchParams({
      assembly: assemblyId,
    })
    url.search = searchParams.toString()
    const uri = url.toString()
    const auth = {
      headers: {
        authorization: `Bearer ${access.accessToken}`,
      },
    }
    const response = await fetch(uri, auth)
    if (!response.ok) {
      const newErrorMessage = await createFetchErrorMessage(
        response,
        'Error when exporting ID',
      )
      throw new Error(newErrorMessage)
    }

    const { exportID } = (await response.json()) as { exportID: string }

    const exportURL = new URL(localhostToAddress(`${access.address}/export`))

    const params: Record<string, string> = {
      exportID,
      assemblyId,
      withFasta: this.flags['with-fasta'] ? 'True' : 'False',
    }
    const exportSearchParams = new URLSearchParams(params)
    exportURL.search = exportSearchParams.toString()
    const exportUri = exportURL.toString()

    const responseExport = await fetch(exportUri, auth)
    if (!responseExport.ok) {
      const newErrorMessage = await createFetchErrorMessage(
        responseExport,
        'Error when exporting gff',
      )
      throw new Error(newErrorMessage)
    }
    const { body } = responseExport
    if (body) {
      const readable = Readable.from(body)
      readable.pipe(process.stdout)
    }
  }
}
