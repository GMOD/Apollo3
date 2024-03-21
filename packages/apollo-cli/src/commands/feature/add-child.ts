import { Flags } from '@oclif/core'
import { ObjectId } from 'bson'
import nodeFetch, { Response } from 'node-fetch'

import { BaseCommand } from '../../baseCommand.js'
import {
  getFeatureById,
  idReader,
  localhostToAddress,
  queryApollo,
} from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static description = 'Add a child feature'

  static flags = {
    'feature-id': Flags.string({
      char: 'i',
      default: '-',
      description: 'Feature ID to add child to; use - to read it from stdin',
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
      this.logToStderr(
        'Error: End coordinate is lower than the start coordinate',
      )
      this.exit(1)
    }
    if (flags.start <= 0) {
      this.logToStderr('Coordinates must be greater than 0')
      this.exit(1)
    }

    const ff = idReader([flags['feature-id']])
    if (ff.length !== 1) {
      this.logToStderr(`Expected only one feature identifier. Got ${ff.length}`)
    }
    const [featureId] = ff

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    const response: Response = await getFeatureById(
      access.address,
      access.accessToken,
      featureId,
    )
    const feature = JSON.parse(await response.text())
    if (!response.ok) {
      const message: string = feature['message' as keyof typeof feature]
      this.logToStderr(message)
      this.exit(1)
    }

    const childRes = await this.addChild(
      access.address,
      access.accessToken,
      feature,
      flags.start - 1,
      flags.end,
      flags.type,
    )
    if (!childRes.ok) {
      const obj = JSON.parse(await response.text())
      const message: string = obj['message' as keyof typeof feature]
      this.logToStderr(message)
      this.exit(1)
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
      this.logToStderr(
        `Error: Child feature coordinates (${start + 1}-${end}) cannot extend beyond parent coordinates (${pStart + 1}-${pEnd})`,
      )
      this.exit(1)
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
    return nodeFetch(url, auth)
  }
}
