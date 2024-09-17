import { Flags } from '@oclif/core'
import { Response, fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import {
  createFetchErrorMessage,
  getRefseqId,
  localhostToAddress,
} from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static description =
    'Get features in assembly, reference sequence or genomic window'

  static examples = [
    {
      description: 'Get all features in myAssembly:',
      command: '<%= config.bin %> <%= command.id %> -a myAssembly',
    },
    {
      description:
        'Get features intersecting chr1:1..1000. You can omit the assembly name if there are no other reference sequences named chr1:',
      command:
        '<%= config.bin %> <%= command.id %> -a myAssembly -r chr1 -s 1 -e 1000',
    },
  ]

  static flags = {
    assembly: Flags.string({
      char: 'a',
      description: 'Find input reference sequence in this assembly',
    }),
    refseq: Flags.string({
      char: 'r',
      description: 'Reference sequence. If unset, query all sequences',
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
      this.error('Start and end coordinates must be greater than 0.')
    }

    const access = await this.getAccess()

    const refseqIds: string[] = await getRefseqId(
      access.address,
      access.accessToken,
      flags.refseq,
      flags.assembly,
    )

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
      for (const x of json[0] as object[]) {
        results.push(x)
      }
    }
    this.log(JSON.stringify(results, null, 2))
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
    const res = await fetch(url, auth)
    if (!res.ok) {
      const errorMessage = await createFetchErrorMessage(
        res,
        'Failed to access Apollo with the current address and/or access token\nThe server returned:\n',
      )
      throw new Error(errorMessage)
    }
    return res
  }
}
