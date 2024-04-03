import { Flags } from '@oclif/core'
import { ObjectId } from 'bson'
import { Response, fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import {
  getAssemblyFromRefseq,
  getFeatureById,
  getRefseqId,
  localhostToAddress,
  wrapLines,
} from '../../utils.js'

export default class Copy extends BaseCommand<typeof Copy> {
  static summary = 'Copy a feature to another location'
  static description = wrapLines(
    'The feature may be copied to the same or to a different assembly. \
    he destination reference sequence may be selected by name only if unique in the database or by name and assembly or by identifier.',
  )

  static examples = [
    {
      description: 'Copy this feature ID to chr1:100 in assembly hg38:',
      command:
        '<%= config.bin %> <%= command.id %> -i 6605826fbd0eee691f83e73f -r chr1 -s 100 -a hg38',
    },
  ]

  static flags = {
    'feature-id': Flags.string({
      char: 'i',
      default: '-',
      description: 'Feature ID to copy to; use - to read it from stdin',
    }),
    refseq: Flags.string({
      char: 'r',
      description: 'Name or ID of target reference sequence',
      required: true,
    }),
    start: Flags.integer({
      char: 's',
      description: 'Start position in target reference sequence',
      required: true,
    }),
    assembly: Flags.string({
      char: 'a',
      description:
        'Name or ID of target assembly. Not required if refseq is unique in the database',
      required: false,
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Copy)

    if (flags.start <= 0) {
      this.logToStderr('Start coordinate must be greater than 0')
      this.exit(1)
    }

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    const res: Response = await getFeatureById(
      access.address,
      access.accessToken,
      flags['feature-id'],
    )
    const feature = (await res.json()) as object
    if (!res.ok) {
      const message: string = feature['message' as keyof typeof feature]
      this.logToStderr(message)
      this.exit(1)
    }

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
      this.exit(1)
    }
    const [refseq] = refseqIds
    const assembly = await getAssemblyFromRefseq(
      access.address,
      access.accessToken,
      refseq,
    )

    const newId = new ObjectId().toHexString()
    const rescopy = await this.copyFeature(
      access.address,
      access.accessToken,
      feature,
      refseq,
      flags.start,
      assembly,
      newId,
    )
    if (!rescopy.ok) {
      const message: string = feature['message' as keyof typeof feature]
      this.logToStderr(message)
      this.exit(1)
    }
    this.exit(0)
  }

  private async copyFeature(
    address: string,
    accessToken: string,
    feature: object,
    refseq: string,
    start: number,
    assembly: string,
    newId: string,
  ): Promise<Response> {
    const featureLen =
      feature['end' as keyof typeof feature] -
      feature['start' as keyof typeof feature]
    const change = {
      typeName: 'AddFeatureChange',
      changedIds: [newId],
      assembly,
      addedFeature: {
        _id: newId,
        refSeq: refseq,
        start: start - 1,
        end: start + featureLen - 1,
        type: feature['type' as keyof typeof feature],
        attributes: feature['attributes' as keyof typeof feature],
        discontinuousLocations:
          feature['discontinuousLocations' as keyof typeof feature],
        strand: feature['strand' as keyof typeof feature],
      },
      copyFeature: true,
      allIds: [newId],
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
    return fetch(url, auth)
  }
}
