import { Args, Flags } from '@oclif/core'
import { fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import {
  convertAssemblyNameToId,
  createFetchErrorMessage,
  idReader,
  localhostToAddress,
} from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static summary = 'Get features given an indexed identifier'
  static description =
    'Get features that match a given indexed identifier, such as the ID of a feature from an imported GFF3 file'

  static examples = [
    {
      description: 'Get features for this indexed identifier:',
      command: '<%= config.bin %> <%= command.id %> -i abc...zyz def...foo',
    },
  ]

  static args = {
    id: Args.string({
      description: 'Indexed identifier to search for',
      required: true,
    }),
  }

  static flags = {
    assembly: Flags.string({
      char: 'a',
      multiple: true,
      description:
        'Assembly names or IDs to search; use "-" to read it from stdin. If omitted search all assemblies',
    }),
    topLevel: Flags.boolean({
      description:
        'Return the top-level parent of the feature instead of the feature itself',
    }),
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Get)

    const access = await this.getAccess()

    const { topLevel } = flags
    const { id } = args

    const assembly = flags.assembly && (await idReader(flags.assembly))
    const assemblyIds =
      assembly &&
      (await convertAssemblyNameToId(
        access.address,
        access.accessToken,
        assembly,
      ))

    if (assemblyIds?.length === 0) {
      this.log(JSON.stringify([], null, 2))
      this.exit(0)
    }

    const url = new URL(
      localhostToAddress(`${access.address}/features/getByIndexedId`),
    )
    const searchParams = new URLSearchParams({ id })
    if (assemblyIds) {
      searchParams.append('assemblies', assemblyIds.join(','))
    }
    if (topLevel) {
      searchParams.append('topLevel', 'true')
    }
    url.search = searchParams.toString()
    const uri = url.toString()
    const auth = {
      headers: {
        authorization: `Bearer ${access.accessToken}`,
        'Content-Type': 'application/json',
      },
    }
    const response = await fetch(uri, auth)
    if (!response.ok) {
      const errorMessage = await createFetchErrorMessage(
        response,
        'Failed to access Apollo with the current address and/or access token\nThe server returned:\n',
      )
      throw new Error(errorMessage)
    }
    const results = (await response.json()) as object

    this.log(JSON.stringify(results, null, 2))
  }
}
