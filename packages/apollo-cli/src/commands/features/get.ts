import { Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'
import { localhostToAddress } from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static description = 'Get features in a genomic window'

  static flags = {
    // Do we need to add "assembly" as required param?
    // Alternatively use syntax "chrom:start-end" or "chrom:start..end" and possibly allow for multiple queries
    refSeq: Flags.string({
      char: 'r',
      description: 'Reference sequence',
      required: true,
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

    const features: Response = await this.getFeatures(
      access.address,
      access.accessToken,
      flags.refSeq,
      flags.start,
      endCoord,
    )

    const json = await features.json()
    this.log(JSON.stringify(json, null, 2))
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
