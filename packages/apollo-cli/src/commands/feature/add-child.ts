/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/restrict-plus-operands */

/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Flags } from '@oclif/core'
import { ObjectId } from 'bson'
import { Response, fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import {
  createFetchErrorMessage,
  getFeatureById,
  idReader,
  localhostToAddress,
  queryApollo,
  wrapLines,
} from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static summary = 'Add a child feature (e.g. add an exon to an mRNA)'
  static description = wrapLines(
    'See the other commands under `apollo feature` to retrive the parent ID of interest and to populate the child feature with attributes.',
  )

  static examples = [
    {
      description:
        'Add an exon at genomic coordinates 10..20 to this feature ID:',
      command:
        '<%= config.bin %> <%= command.id %> -i 6605826fbd0eee691f83e73f -t exon -s 10 -e 20',
    },
  ]

  static flags = {
    'feature-id': Flags.string({
      char: 'i',
      default: '-',
      description:
        'Add a child to this feature ID; use - to read it from stdin',
    }),
    start: Flags.integer({
      char: 's',
      required: true,
      description: 'Start coordinate of the child feature (1-based)',
    }),
    end: Flags.integer({
      char: 'e',
      required: true,
      description: 'End coordinate of the child feature (1-based)',
    }),
    type: Flags.string({
      char: 't',
      required: true,
      description: 'Type of child feature',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Get)

    if (flags.end < flags.start) {
      this.error('Error: End coordinate is lower than the start coordinate')
    }
    if (flags.start <= 0) {
      this.error('Coordinates must be greater than 0')
    }

    const ff = idReader([flags['feature-id']])
    if (ff.length !== 1) {
      this.error(`Expected only one feature identifier. Got ${ff.length}`)
    }
    const [featureId] = ff

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    const res: Response = await getFeatureById(
      access.address,
      access.accessToken,
      featureId,
    )
    if (!res.ok) {
      const errorMessage = await createFetchErrorMessage(
        res,
        'getFeatureById failed',
      )
      throw new Error(errorMessage)
    }
    const feature = JSON.parse(await res.text())
    const childRes = await this.addChild(
      access.address,
      access.accessToken,
      feature,
      flags.start - 1,
      flags.end,
      flags.type,
    )
    if (!childRes.ok) {
      const errorMessage = await createFetchErrorMessage(
        childRes,
        'Add child failed',
      )
      throw new Error(errorMessage)
    }
    this.exit(0)
  }

  private async addChild(
    address: string,
    accessToken: string,
    parentFeature: object,
    start: number,
    end: number,
    type: string,
  ): Promise<Response> {
    const pStart = parentFeature['start' as keyof typeof parentFeature]
    const pEnd = parentFeature['end' as keyof typeof parentFeature]
    if (start < pStart || end > pEnd) {
      this.error(
        `Error: Child feature coordinates (${start + 1}-${end}) cannot extend beyond parent coordinates (${pStart + 1}-${pEnd})`,
      )
    }
    const res = await queryApollo(address, accessToken, 'refSeqs')
    const refSeqs = (await res.json()) as object[]
    const refSeq = parentFeature['refSeq' as keyof typeof parentFeature]
    let assembly = ''
    for (const x of refSeqs) {
      if (x['_id' as keyof typeof x] === refSeq) {
        assembly = x['assembly' as keyof typeof x]
        break
      }
    }
    const change = {
      typeName: 'AddFeatureChange',
      changedIds: [parentFeature['_id' as keyof typeof parentFeature]],
      assembly,
      addedFeature: {
        _id: new ObjectId().toHexString(),
        gffId: '',
        refSeq,
        start,
        end,
        type,
      },
      parentFeatureId: parentFeature['_id' as keyof typeof parentFeature],
    }
    const url = new URL(localhostToAddress(`${address}/changes`))
    const auth = {
      method: 'POST',
      body: JSON.stringify(change),
      headers: {
        authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
    const response = await fetch(url, auth)
    if (!response.ok) {
      const errorMessage = await createFetchErrorMessage(
        response,
        'getFeatureById failed',
      )
      throw new Error(errorMessage)
    }
    return response
  }
}
