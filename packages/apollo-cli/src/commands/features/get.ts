import path from 'node:path'

import { Args, Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'
import { Config } from '../../Config.js'

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
    const { args } = await this.parse(Get)
    const { flags } = await this.parse(Get)

    const configFile = path.join(this.config.configDir, 'config.yaml')
    const config: Config = new Config(configFile)
    const address: string | undefined = config.get('address', flags.profile)
    const token: string | undefined = config.get('accessType', flags.profile)

    const endCoord: number = flags.end ?? Number.MAX_SAFE_INTEGER
    if (flags.start <= 0 || endCoord <= 0) {
      this.logToStderr('Start and end coordinates must be greater than 0.')
      this.exit(1)
    }

    if (address === undefined || token === undefined) {
      // handle this
    } else {
      const features: string[] = await this.getFeatures(
        address,
        token,
        flags.refSeq,
        flags.start,
        endCoord,
      )
      process.stdout.write(`${JSON.stringify(features, null, 2)}\n`)
    }
  }

  private async getFeatures(
    address: string,
    token: string,
    refSeq: string,
    start: number,
    end: number,
  ): Promise<string[]> {
    const url = new URL(`${address}/features/getFeatures`)
    const searchParams = new URLSearchParams({
      refSeq,
      start: start.toString(),
      end: end.toString(),
    })
    url.search = searchParams.toString()

    token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IkRhcmlvIEJlcmFsZGkiLCJlbWFpbCI6ImRhcmlvLmJlcmFsZGlAZ21haWwuY29tIiwicm9sZSI6ImFkbWluIiwiaWQiOiI2NTUzN2I1OWNiYmYxN2FjZGI2NWU5MWMiLCJpYXQiOjE3MDY3MTA1ODQsImV4cCI6MTcwNjc5Njk4NH0.uSLcgueGBpJxwQADLQPXngDCBBEItfe6RkzCksCnwC8'

    const auth = {
      headers: {
        authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
    try {
      const response = await fetch(url, auth)
      return await response.json()
    } catch {
      throw new Error('Unable to get features...')
    }
  }
}
