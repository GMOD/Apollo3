import type { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import type { SerializedDeleteFeatureChange } from '@apollo-annotation/shared'
import { Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'
import { idReader } from '../../utils.js'

export default class Delete extends BaseCommand<typeof Delete> {
  static summary = 'Delete one or more features by ID'
  static description =
    'Note that deleting a child feature after deleting its parent will result in an error unless you set -f/--force.'

  static flags = {
    'feature-id': Flags.string({
      char: 'i',
      default: ['-'],
      description: 'Feature IDs to delete',
      multiple: true,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Ignore non-existing features',
    }),
    'dry-run': Flags.boolean({
      char: 'n',
      description: 'Only show what would be delete',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Delete)

    const tmpIds = await idReader(flags['feature-id'])
    const featureIds = new Set<string>()
    for (const x of tmpIds) {
      featureIds.add(x)
    }

    for (const featureId of featureIds) {
      const response = await this.fetch(`features/${featureId}`)
      if (response.status === 404 && flags.force) {
        continue
      }
      const feature = (await response.json()) as AnnotationFeatureSnapshot
      if (flags['dry-run']) {
        this.log(JSON.stringify(feature, null, 2))
      } else {
        await this.deleteFeature(feature)
      }
    }
  }

  private async deleteFeature(
    feature: AnnotationFeatureSnapshot,
  ): Promise<void> {
    const changeJson: SerializedDeleteFeatureChange = {
      typeName: 'DeleteFeatureChange',
      changedIds: [feature._id],
      assembly: '111222333444555666777888', // Use a placeholder objectId (i.e. some 24 chars)
      deletedFeature: {
        _id: feature._id,
        refSeq: feature.refSeq,
        type: feature.type,
        min: feature.min,
        max: feature.max,
        attributes: feature.attributes,
      },
    }
    await this.post('changes', JSON.stringify(changeJson))
  }
}
