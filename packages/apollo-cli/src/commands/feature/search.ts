/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Flags } from '@oclif/core'
import { Response, fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import {
  convertAssemblyNameToId,
  createFetchErrorMessage,
  idReader,
  localhostToAddress,
  queryApollo,
  wrapLines,
} from '../../utils.js'
import { ApolloAssemblySnapshot } from '@apollo-annotation/mst'

async function searchFeatures(
  address: string,
  accessToken: string,
  assemblies: string[],
  term: string,
): Promise<Response> {
  const url = new URL(localhostToAddress(`${address}/features/searchFeatures`))
  const searchParams = new URLSearchParams({
    assemblies: assemblies.join(','),
    term,
  })
  url.search = searchParams.toString()
  const uri = url.toString()
  const auth = {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  }
  const response = await fetch(uri, auth)
  if (!response.ok) {
    const errorMessage = await createFetchErrorMessage(
      response,
      'searchFeatures failed',
    )
    throw new Error(errorMessage)
  }

  return response
}

export default class Search extends BaseCommand<typeof Search> {
  static summary = 'Free text search for feature in one or more assemblies'
  static description = wrapLines(
    `Return features matching a query string. This command searches only in:

    - Attribute *values* (not attribute names)
    - Source field (which in fact is stored as an attribute)
    - Feature type

    The search mode is:

    - Case insensitive
    - Match only full words, but not necessarily the full value
    - Common words are ignored. E.g. "the", "with"

    For example, given this feature:

    chr1 example SNP 10 30 0.987 . . "someKey=Fingerprint BAC with reads"

    Queries "bac" or "mRNA" return the feature. Instead these queries will NOT match:

    - "someKey"
    - "with"
    - "Finger"
    - "chr1"
    - "0.987"`,
  )

  static examples = [
    {
      description: 'Search "bac" in these assemblies:',
      command: '<%= config.bin %> <%= command.id %> -a mm9 mm10 -t bac',
    },
  ]

  static flags = {
    text: Flags.string({
      char: 't',
      required: true,
      description: 'Search for this text query',
    }),
    assembly: Flags.string({
      char: 'a',
      multiple: true,
      description: wrapLines(
        'Assembly names or IDs to search; use "-" to read it from stdin. If omitted search all assemblies',
      ),
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Search)

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    let assemblyIds: string[] = []
    if (flags.assembly === undefined) {
      const asm = await queryApollo(
        access.address,
        access.accessToken,
        'assemblies',
      )
      for (const x of (await asm.json()) as ApolloAssemblySnapshot[]) {
        assemblyIds.push(x._id)
      }
    } else {
      const assembly = idReader(flags.assembly)
      assemblyIds = await convertAssemblyNameToId(
        access.address,
        access.accessToken,
        assembly,
      )
    }

    if (assemblyIds.length === 0) {
      this.log(JSON.stringify([], null, 2))
      this.exit(0)
    }

    const response: Response = await searchFeatures(
      access.address,
      access.accessToken,
      assemblyIds,
      flags.text,
    )
    const results = JSON.parse(await response.text())
    this.log(JSON.stringify(results, null, 2))
  }
}
