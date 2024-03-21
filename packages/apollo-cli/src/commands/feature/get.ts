import { assert } from 'node:console'

import { Flags } from '@oclif/core'
import nodeFetch, { Response } from 'node-fetch'

import { BaseCommand } from '../../baseCommand.js'
import {
  convertAssemblyNameToId,
  getRefseqId,
  localhostToAddress,
  queryApollo,
} from '../../utils.js'

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

    let assembly = ''
    if (flags.assembly !== undefined) {
      const xa: string[] = await convertAssemblyNameToId(
        access.address,
        access.accessToken,
        [flags.assembly],
      )
      if (xa.length === 0) {
        this.logToStderr(`Assembly ${flags.assembly} does not exist`)
        this.exit(1)
      }
      ;[assembly] = xa
    }

    let refseqIds: string[] = []

    if (flags.refseq === undefined && assembly !== '') {
      // Get all refseqs for this assembly
      const res: Response = await queryApollo(
        access.address,
        access.accessToken,
        'refSeqs',
      )
      const refSeqs = (await res.json()) as object[]
      for (const x of refSeqs) {
        if (x['assembly' as keyof typeof x] === assembly) {
          refseqIds.push(x['_id' as keyof typeof x])
        }
      }
    } else if (flags.refseq === undefined) {
      this.logToStderr(
        'Please provide a reference sequence and/or an assembly to query',
      )
      this.exit(1)
    } else {
      refseqIds = await getRefseqId(
        access.address,
        access.accessToken,
        flags.refseq,
        assembly,
      )
      if (refseqIds.length > 1) {
        this.logToStderr(
          `More than one reference sequence found with name ${flags.refseq}`,
        )
        this.exit(1)
      }
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
    const response = await nodeFetch(url, auth)
    if (response.ok) {
      return response
    }
    const msg = `Failed to access Apollo with the current address and/or access token\nThe server returned:\n${response.statusText}`
    throw new Error(msg)
  }
}
