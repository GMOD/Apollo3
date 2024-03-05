import * as fs from 'node:fs'

import { Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'
import { localhostToAddress, subAssemblyNameToId } from '../../utils.js'

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
  return response
}

export default class Search extends BaseCommand<typeof Search> {
  static description = 'Free text search for feature in one or more assemblies'

  static flags = {
    assemblies: Flags.string({
      char: 'a',
      default: ['-'],
      multiple: true,
      description:
        'Assembly names or IDs to search; use "-" to read it from stdin',
    }),
    text: Flags.string({
      char: 't',
      required: true,
      description: 'Search for this text query',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Search)

    // eslint-disable-next-line prefer-destructuring
    let nameOrIds = flags.assemblies
    if (JSON.stringify(nameOrIds) === JSON.stringify(['-'])) {
      nameOrIds = fs
        .readFileSync(process.stdin.fd)
        .toString()
        .trim()
        .split(/(\s+)/)
    }
    nameOrIds = nameOrIds.filter((x) => x.trim() != '')

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    const assemblies = await subAssemblyNameToId(
      access.address,
      access.accessToken,
      nameOrIds,
    )

    if (assemblies.length === 0) {
      this.log(JSON.stringify([], null, 2))
      this.exit(0)
    }

    const response: Response = await searchFeatures(
      access.address,
      access.accessToken,
      assemblies,
      flags.text,
    )
    const results = JSON.parse(await response.text())
    if (!response.ok) {
      const message: string = results['message' as keyof typeof results]
      this.logToStderr(message)
      this.exit(1)
    }
    this.log(JSON.stringify(results, null, 2))
  }
}
