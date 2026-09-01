import type { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import type { SerializedAddFeatureChange } from '@apollo-annotation/shared'
import { Flags } from '@oclif/core'
import { ObjectId } from 'bson'

import { BaseCommand } from '../../baseCommand.js'

export default class Copy extends BaseCommand<typeof Copy> {
  static summary = 'Copy a feature to another location'
  static description =
    'The feature may be copied to the same or to a different assembly. \
The destination reference sequence may be selected by name only if unique in \
the database or by name and assembly or by identifier.'

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
      this.error('Start coordinate must be greater than 0')
    }

    const feature = await this.getFeatureById(flags['feature-id'])

    const refseqIds = await this.getRefseqId(flags.refseq, flags.assembly)
    if (refseqIds.length === 0) {
      this.error('No reference sequence found')
    }
    const [refseq] = refseqIds
    const assembly = await this.getAssemblyFromRefseq(refseq)

    const newId = new ObjectId().toHexString()
    await this.copyFeature(feature, refseq, flags.start, assembly, newId)
  }

  private async copyFeature(
    feature: AnnotationFeatureSnapshot,
    refseq: string,
    min: number,
    assembly: string,
    newId: string,
  ): Promise<void> {
    const featureLen = feature.max - feature.min

    const change: SerializedAddFeatureChange = {
      typeName: 'AddFeatureChange',
      changedIds: [newId],
      assembly,
      addedFeature: {
        _id: newId,
        refSeq: refseq,
        min: min - 1,
        max: min + featureLen - 1,
        type: feature.type,
        attributes: feature.attributes,
        strand: feature.strand,
      },
      copyFeature: true,
      allIds: [newId],
    }
    await this.post('changes', JSON.stringify(change))
  }
}
