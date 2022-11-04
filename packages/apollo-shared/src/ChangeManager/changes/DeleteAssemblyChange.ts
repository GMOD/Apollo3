import { AssemblySpecificChange } from './abstract/AssemblySpecificChange'
import {
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from './abstract/Change'

interface SerializedDeleteAssemblyBase extends SerializedChange {
  changes: DeleteAssemblyDetails
  typeName: 'DeleteAssemblyChange'
}

export interface DeleteAssemblyDetails {
  parentFeatureId?: string // Parent feature to where feature will be added
}

// interface SerializedDeleteAssemblySingle
//   extends SerializedDeleteAssemblyBase,
//     DeleteAssemblyDetails {}

// interface SerializedDeleteAssemblyMultiple
//   extends SerializedDeleteAssemblyBase {
//   changes: DeleteAssemblyDetails[]
// }

// type SerializedDeleteAssembly =
//   | SerializedDeleteAssemblySingle
//   | SerializedDeleteAssemblyMultiple

export class DeleteAssemblyChange extends AssemblySpecificChange {
  typeName = 'DeleteAssemblyChange' as const
  changes: DeleteAssemblyDetails

  constructor(json: SerializedDeleteAssemblyBase, options?: ChangeOptions) {
    super(json, options)
    this.changes = json.changes // : [json]
    // this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedDeleteAssemblyBase {
    const { changes, typeName, assembly } = this
    return { changes, typeName, assembly }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async applyToServer(backend: ServerDataStore) {
    const { assembly, logger } = this
    logger.debug?.(`***************** ASSEMBLY ******************`)
    const { assemblyModel, featureModel, refSeqModel, session } = backend
    logger.debug?.(`***************** ASSEMBLY: ${assembly}`)

    const assembly = await assemblyModel
      .findById(assembly)
      .session(session)
      .exec()
    if (!assembly) {
      const errMsg = `*** ERROR: Assembly with id "${assembly}" not found`
      logger.error(errMsg)
      throw new Error(errMsg)
    }

    // let featureCnt = 0
    // this.logger.debug?.(`changes: ${JSON.stringify(changes)}`)

    // // Loop the changes
    // for (const change of changes) {
    //   this.logger.debug?.(`change: ${JSON.stringify(change)}`)
    //   const { addedFeature, parentFeatureId } = change
    //   const { refSeq } = addedFeature
    //   const refSeqDoc = await refSeqModel
    //     .findById(refSeq)
    //     .session(session)
    //     .exec()
    //   if (!refSeqDoc) {
    //     throw new Error(
    //       `RefSeq was not found by assemblyId "${assemblyId}" and seq_id "${refSeq}" not found`,
    //     )
    //   }
    //   if (parentFeatureId) {
    //     const topLevelFeature = await featureModel
    //       .findOne({ allIds: parentFeatureId })
    //       .session(session)
    //       .exec()
    //     if (!topLevelFeature) {
    //       throw new Error(`Could not find feature with ID "${parentFeatureId}"`)
    //     }
    //     this.logger.log({ topLevelFeature })
    //     const parentFeature = this.getFeatureFromId(
    //       topLevelFeature,
    //       parentFeatureId,
    //     )
    //     if (!parentFeature) {
    //       throw new Error(
    //         `Could not find feature with ID "${parentFeatureId}" in feature "${topLevelFeature._id}"`,
    //       )
    //     }
    //     if (!parentFeature.children) {
    //       parentFeature.children = new Map()
    //     }
    //     parentFeature.children.set(addedFeature._id, {
    //       allIds: [],
    //       ...addedFeature,
    //       // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //       // @ts-ignore
    //       _id: addedFeature._id,
    //     })
    //     const childIds = this.getChildFeatureIds(addedFeature)
    //     topLevelFeature.allIds.push(addedFeature._id, ...childIds)
    //     topLevelFeature.save()
    //   } else {
    //     const childIds = this.getChildFeatureIds(addedFeature)
    //     const allIds = [addedFeature._id, ...childIds]
    //     const [newFeatureDoc] = await featureModel.create(
    //       [{ allIds, ...addedFeature }],
    //       { session },
    //     )
    //     this.logger.verbose?.(`Added docId "${newFeatureDoc._id}"`)
    //   }
    //   featureCnt++
    // }
    // this.logger.debug?.(`Added ${featureCnt} new feature(s) into database.`)
  }

  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('applyToLocalGFF3 not implemented')
  }

  async applyToClient(dataStore: ClientDataStore) {
    if (!dataStore) {
      throw new Error('No data store')
    }
    // for (const change of this.changes) {
    //   const { addedFeature, parentFeatureId } = change
    //   if (parentFeatureId) {
    //     const parentFeature = dataStore.getFeature(parentFeatureId)
    //     if (!parentFeature) {
    //       throw new Error(`Could not find parent feature "${parentFeatureId}"`)
    //     }
    //     parentFeature.addChild(addedFeature)
    //   } else {
    //     dataStore.addFeature(this.assemblyId, addedFeature)
    //   }
    // }
  }

  getInverse() {
    return new DeleteAssemblyChange({
      typeName: 'DeleteAssemblyChange',
      assembly: '123',
      changes: {},
    })
  }
}

export function isDeleteAssembly(
  change: unknown,
): change is DeleteAssemblyChange {
  return (change as DeleteAssemblyChange).typeName === 'DeleteAssemblyChange'
}
