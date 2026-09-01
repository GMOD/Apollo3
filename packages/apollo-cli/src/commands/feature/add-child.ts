import type { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import type { SerializedAddFeatureChange } from '@apollo-annotation/shared'
import { Flags } from '@oclif/core'
import { ObjectId } from 'bson'

import { BaseCommand } from '../../baseCommand.js'
import { idReader } from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static summary = 'Add a child feature (e.g. add an exon to an mRNA)'
  static description =
    'See the other commands under `apollo feature` \
to retrive the parent ID of interest and to populate the child feature with attributes.'

  static examples = [
    {
      description:
        'Add an exon at genomic coordinates 10..20 to this feature ID:',
      command:
        '<%= config.bin %> <%= command.id %> -i 660...73f -t exon -s 10 -e 20',
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

    const ff = await idReader([flags['feature-id']])
    if (ff.length !== 1) {
      this.error(`Expected only one feature identifier. Got ${ff.length}`)
    }
    const [featureId] = ff

    const feature = await this.getFeatureById(featureId)
    await this.addChild(feature, flags.start - 1, flags.end, flags.type)
  }

  private async addChild(
    parentFeature: AnnotationFeatureSnapshot,
    min: number,
    max: number,
    type: string,
  ): Promise<void> {
    const pMin = parentFeature.min
    const pMax = parentFeature.max
    if (min < pMin || max > pMax) {
      this.error(
        `Error: Child feature coordinates (${min + 1}-${max}) cannot extend beyond parent coordinates (${pMin + 1}-${pMax})`,
      )
    }
    const refSeqs = (await this.get('refSeqs')) as object[]
    const { refSeq, _id } = parentFeature
    let assembly = ''
    for (const x of refSeqs) {
      if (x['_id' as keyof typeof x] === refSeq) {
        assembly = x['assembly' as keyof typeof x]
        break
      }
    }
    const change: SerializedAddFeatureChange = {
      typeName: 'AddFeatureChange',

      changedIds: [_id],
      assembly,
      addedFeature: {
        _id: new ObjectId().toHexString(),
        refSeq,
        min,
        max,
        type,
      },

      parentFeatureId: _id,
    }
    await this.post('changes', JSON.stringify(change))
  }
}
