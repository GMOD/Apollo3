import { assert } from 'node:console'

import { Flags } from '@oclif/core'
import { Response, fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import { getRefseqId, localhostToAddress } from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static description = 'Get features in a genomic window'

  static flags = {
    refseq: Flags.string({
      char: 'r',
      description: 'Reference sequence. If unset, query all sequences',
    }),
    assembly: Flags.string({
      char: 'a',
      description: 'Find input reference sequence in this assembly',
    }),
    start: Flags.integer({
      char: 's',
      description: 'Start coordinate (1-based)',
      default: 1,
    }),
    end: Flags.integer({
      char: 'e',
      description: 'End coordinate',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Get)

    const endCoord: number = flags.end ?? Number.MAX_SAFE_INTEGER
    if (flags.start <= 0 || endCoord <= 0) {
      this.logToStderr('Start and end coordinates must be greater than 0.')
      this.exit(1)
    }

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    let refseqIds: string[] = []
    try {
      refseqIds = await getRefseqId(
        access.address,
        access.accessToken,
        flags.refseq,
        flags.assembly,
      )
    } catch (error) {
      this.logToStderr((error as Error).message)
      this.exit(1)
    }
    if (refseqIds.length === 0) {
      this.logToStderr('No reference sequence found')
      this.log(JSON.stringify([[], []], null, 2))
      this.exit(0)
    }

    const results: object[] = []
    for (const refseq of refseqIds) {
      const features: Response = await this.getFeatures(
        access.address,
        access.accessToken,
        refseq,
        flags.start,
        endCoord,
      )
      const json = (await features.json()) as object[]
      assert(JSON.stringify(json[1]) === '[]' && json.length === 2)
      results.push(json[0])
    }
    results.push([])
    this.log(JSON.stringify(results, null, 2))
    this.exit(0)
  }

  private async getFeatures(
    address: string,
    token: string,
    refSeq: string,
    start: number,
    end: number,
  ): Promise<Response> {
    const url = new URL(localhostToAddress(`${address}/features/getFeatures`))
    const searchParams = new URLSearchParams({
      refSeq,
      start: start.toString(),
      end: end.toString(),
    })
    url.search = searchParams.toString()
    const auth = {
      headers: {
        authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
    const response = await fetch(url, auth)
    if (response.ok) {
      return response
    }
    const msg = `Failed to access Apollo with the current address and/or access token\nThe server returned:\n${response.statusText}`
    throw new Error(msg)
  }
}
