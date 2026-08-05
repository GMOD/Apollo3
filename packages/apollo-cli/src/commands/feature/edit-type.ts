import type { SerializedTypeChange } from '@apollo-annotation/shared'
import { Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'
import { idReader } from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static summary = 'Edit or view feature type'
  static description =
    'Feature type is column 3 in gff format.\
It must be a valid sequence ontology term although but the valifdity of the new term is not checked.'

  static flags = {
    'feature-id': Flags.string({
      char: 'i',
      default: '-',
      description: 'Feature ID to edit or "-" to read it from stdin',
    }),
    type: Flags.string({
      char: 't',
      description:
        'Assign feature to this type. If unset return the current type',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Get)

    const ff = await idReader([flags['feature-id']])
    if (ff.length !== 1) {
      this.error(`Expected only one feature identifier. Got ${ff.length}`)
    }
    const [featureId] = ff

    const featureJson = await this.getFeatureById(featureId)

    const currentType = featureJson.type
    if (flags.type === undefined) {
      this.log(currentType)
      return
    }
    if (flags.type === currentType) {
      this.logToStderr(
        `NOTE: Feature ${featureId} is already of type "${flags.type}"`,
      )
      return
    }

    const assembly = await this.getAssemblyFromRefseq(featureJson.refSeq)

    const changeJson: SerializedTypeChange = {
      typeName: 'TypeChange',
      changedIds: [featureId],
      assembly,
      featureId,
      oldType: currentType,
      newType: flags.type,
    }

    await this.post('changes', JSON.stringify(changeJson))
  }
}
