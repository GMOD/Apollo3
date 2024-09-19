import { Flags } from '@oclif/core'
import { Response, fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import {
  createFetchErrorMessage,
  getAssemblyFromRefseq,
  getFeatureById,
  idReader,
  localhostToAddress,
  wrapLines,
} from '../../utils.js'
import { SerializedTypeChange } from '@apollo-annotation/shared'
import { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'

export default class Get extends BaseCommand<typeof Get> {
  static summary = 'Edit or view feature type'
  static description = wrapLines(
    'Feature type is column 3 in gff format.\
    It must be a valid sequence ontology term although but the valifdity of the new term is not checked.',
  )

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

    const access = await this.getAccess()

    const response: Response = await getFeatureById(
      access.address,
      access.accessToken,
      featureId,
    )
    if (!response.ok) {
      const errorMessage = await createFetchErrorMessage(
        response,
        'getFeatureById failed',
      )
      throw new Error(errorMessage)
    }
    const featureJson = JSON.parse(
      await response.text(),
    ) as AnnotationFeatureSnapshot

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

    const assembly = await getAssemblyFromRefseq(
      access.address,
      access.accessToken,
      featureJson.refSeq,
    )

    const changeJson: SerializedTypeChange = {
      typeName: 'TypeChange',
      changedIds: [featureId],
      assembly,
      featureId,
      oldType: currentType,
      newType: flags.type,
    }

    const url = new URL(localhostToAddress(`${access.address}/changes`))

    const auth = {
      method: 'POST',
      body: JSON.stringify(changeJson),
      headers: {
        authorization: `Bearer ${access.accessToken}`,
        'Content-Type': 'application/json',
      },
    }
    const res = await fetch(url, auth)
    if (!res.ok) {
      const errorMessage = await createFetchErrorMessage(
        res,
        'edit-type failed',
      )
      throw new Error(errorMessage)
    }
  }
}
