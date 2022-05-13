import { createReadStream } from 'fs'
import { join } from 'path'
import { createGunzip } from 'zlib'

import gff, { GFF3Feature } from '@gmod/gff'
import { v4 as uuidv4 } from 'uuid'

import {
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from './Change'
import {
  FeatureChange,
  GFF3FeatureLineWithFeatureIdAndOptionalRefs,
} from './FeatureChange'

interface SerializedAddFeaturesFromFileChangeBase extends SerializedChange {
  typeName: 'AddFeaturesFromFileChange'
}

interface AddFeaturesFromFileChangeDetails {
  fileChecksum: string
}

interface SerializedAddFeaturesFromFileChangeSingle
  extends SerializedAddFeaturesFromFileChangeBase,
    AddFeaturesFromFileChangeDetails {}

interface SerializedAddFeaturesFromFileChangeMultiple
  extends SerializedAddFeaturesFromFileChangeBase {
  changes: AddFeaturesFromFileChangeDetails[]
}

type SerializedAddFeaturesFromFileChange =
  | SerializedAddFeaturesFromFileChangeSingle
  | SerializedAddFeaturesFromFileChangeMultiple

export class AddFeaturesFromFileChange extends FeatureChange {
  typeName = 'AddFeaturesFromFileChange' as const
  changes: AddFeaturesFromFileChangeDetails[]

  constructor(
    json: SerializedAddFeaturesFromFileChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedAddFeaturesFromFileChange {
    if (this.changes.length === 1) {
      const [{ fileChecksum }] = this.changes
      return {
        typeName: this.typeName,
        changedIds: this.changedIds,
        assemblyId: this.assemblyId,
        fileChecksum,
      }
    }
    return {
      typeName: this.typeName,
      changedIds: this.changedIds,
      assemblyId: this.assemblyId,
      changes: this.changes,
    }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async applyToServer(backend: ServerDataStore) {
    const { featureModel, refSeqModel } = backend
    const { changes, assemblyId } = this

    for (const change of changes) {
      const { fileChecksum } = change
      this.logger.debug?.(`File checksum: '${fileChecksum}'`)

      const { FILE_UPLOAD_FOLDER } = process.env
      if (!FILE_UPLOAD_FOLDER) {
        throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
      }
      const compressedFullFileName = join(
        FILE_UPLOAD_FOLDER,
        `${fileChecksum}.gz`,
      )

      // Read data from compressed file and parse the content
      createReadStream(compressedFullFileName)
        .pipe(createGunzip())
        .pipe(
          gff.parseStream({
            parseSequences: false,
            parseComments: false,
            parseDirectives: false,
            parseFeatures: true,
          }),
        )
        .on('data', async (gff3Item: GFF3Feature) => {
          this.logger.verbose?.(`ENTRY=${JSON.stringify(gff3Item)}`)
          for (const featureLine of gff3Item) {
            const refName = featureLine.seq_id
            if (!refName) {
              throw new Error(
                `Valid seq_id not found in feature ${JSON.stringify(
                  featureLine,
                )}`,
              )
            }
            const refSeqDoc = await refSeqModel
              .findOne({ assembly: assemblyId, name: refName })
              .exec()
            if (!refSeqDoc) {
              throw new Error(
                `RefSeq was not found by assemblyId "${assemblyId}" and seq_id "${refName}" not found`,
              )
            }
            // Let's add featureId to parent feature
            const featureId = uuidv4()
            const featureIds = [featureId]
            this.logger.verbose?.(
              `Added new FeatureId: value=${JSON.stringify(featureLine)}`,
            )

            // Let's add featureId to each child recursively
            this.setAndGetFeatureIdRecursively(
              { ...featureLine, featureId },
              featureIds,
            )
            this.logger.verbose?.(
              `So far apollo ids are: ${featureIds.toString()}\n`,
            )

            // Add into Mongo
            featureModel.create({
              refSeq: refSeqDoc._id,
              featureId,
              featureIds,
              ...featureLine,
            })
          }
        })
    }
    this.logger.debug?.(`New features added into database!`)
  }

  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('applyToLocalGFF3 not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async applyToClient(dataStore: ClientDataStore) {}

  getInverse() {
    return new AddFeaturesFromFileChange(
      {
        changedIds: this.changedIds,
        typeName: 'AddFeaturesFromFileChange',
        changes: this.changes,
        assemblyId: this.assemblyId,
      },
      { logger: this.logger },
    )
  }

  /**
   * Loop child features in parent feature and add featureId to each child's attribute
   * @param parentFeature - Parent feature
   */
  setAndGetFeatureIdRecursively(
    parentFeature: GFF3FeatureLineWithFeatureIdAndOptionalRefs,
    featureIdArrAsParam: string[],
  ): string[] {
    this.logger.verbose?.(
      `Value in recursive method = ${JSON.stringify(parentFeature)}`,
    )
    if (parentFeature.child_features?.length === 0) {
      delete parentFeature.child_features
    }
    if (parentFeature.derived_features?.length === 0) {
      delete parentFeature.derived_features
    }
    // If there are child features
    if (parentFeature.child_features) {
      parentFeature.child_features = parentFeature.child_features.map(
        (childFeature) =>
          childFeature.map((childFeatureLine) => {
            const featureId = uuidv4()
            featureIdArrAsParam.push(featureId)
            const newChildFeature = { ...childFeatureLine, featureId }
            this.setAndGetFeatureIdRecursively(
              newChildFeature,
              featureIdArrAsParam,
            )
            return newChildFeature
          }),
      )
    }
    return featureIdArrAsParam
  }
}
