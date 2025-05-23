import { type AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import { type SerializedDeleteFeatureChange } from '@apollo-annotation/shared'
import { Flags } from '@oclif/core'
import { type Response, fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import {
  createFetchErrorMessage,
  getFeatureById,
  idReader,
  localhostToAddress,
} from '../../utils.js'

async function deleteFeature(
  address: string,
  accessToken: string,
  feature: AnnotationFeatureSnapshot,
): Promise<Response> {
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
  const url = new URL(localhostToAddress(`${address}/changes`))
  const auth = {
    method: 'POST',
    body: JSON.stringify(changeJson),
    headers: {
      authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  }
  const response = await fetch(url, auth)
  if (!response.ok) {
    const errorMessage = await createFetchErrorMessage(
      response,
      'deleteFeature failed',
    )
    throw new Error(errorMessage)
  }
  return response
}

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

    const access = await this.getAccess()

    for (const featureId of featureIds) {
      const res: Response = await getFeatureById(
        access.address,
        access.accessToken,
        featureId,
      )
      if (res.status === 404 && flags.force) {
        continue
      }
      if (!res.ok) {
        const errorMessage = await createFetchErrorMessage(
          res,
          'getFeatureById failed',
        )
        throw new Error(errorMessage)
      }
      const feature = JSON.parse(await res.text()) as AnnotationFeatureSnapshot
      if (flags['dry-run']) {
        this.log(JSON.stringify(feature, null, 2))
      } else {
        const delFet: Response = await deleteFeature(
          access.address,
          access.accessToken,
          feature,
        )
        if (!delFet.ok) {
          const errorMessage = await createFetchErrorMessage(
            delFet,
            'Delete feature failed',
          )
          throw new Error(errorMessage)
        }
      }
    }
  }
}
