import { createReadStream, createWriteStream } from 'fs'
import { join } from 'path'
import { createGunzip } from 'zlib'

import gff, { GFF3Feature, GFF3FeatureLine } from '@gmod/gff'
import { v4 as uuidv4 } from 'uuid'

import {
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from './Change'
import { FeatureChange } from './FeatureChange'

interface GFF3FeatureLineWithOptionalRefs extends GFF3FeatureLine {
  // eslint-disable-next-line camelcase
  child_features?: GFF3Feature[]
  // eslint-disable-next-line camelcase
  derived_features?: GFF3Feature[]
}

interface FeaturesFromFileChange {
  fileChecksum: string
  assemblyId: string
}

interface SerializedAddFeaturesFromFileChange extends SerializedChange {
  typeName: 'AddFeaturesFromFileChange'
  changes: FeaturesFromFileChange[]
}

export class AddFeaturesFromFileChange extends FeatureChange {
  typeName = 'AddFeaturesFromFileChange' as const
  changes: FeaturesFromFileChange[]

  constructor(
    json: SerializedAddFeaturesFromFileChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.changedIds = json.changedIds
    this.changes = json.changes
  }

  toJSON() {
    return {
      changedIds: this.changedIds,
      typeName: this.typeName,
      changes: this.changes,
      assemblyId: this.assemblyId,
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
      this.logger.debug?.(`*** File checksum: '${fileChecksum}'`)

      const { FILE_UPLOAD_FOLDER } = process.env
      if (!FILE_UPLOAD_FOLDER) {
        throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
      }
      const compressedFullFileName = join(
        FILE_UPLOAD_FOLDER,
        `${fileChecksum}.gz`,
      )
      const uncompressedFullFileName = join(
        FILE_UPLOAD_FOLDER,
        `${fileChecksum}`,
      )
      await this.uncompressFile(
        compressedFullFileName,
        uncompressedFullFileName,
      )

      const uncompressedFullFileName2 = join(FILE_UPLOAD_FOLDER, 'eka')
      await createReadStream(uncompressedFullFileName2) // ******* WHY CONTENT CANNOT BE READ FROM UNCOMPRESSED FILE ?????********//
        .pipe(gff.parseStream({ parseSequences: false }))
        .on('data', async (gff3Item) => {
          if (Array.isArray(gff3Item)) {
            // gff3Item is a GFF3Feature
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
              this.setAndGetFeatureIdRecursively(featureLine, featureIds)
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
          }
        })
    }
    this.logger.debug?.(`New features added into database!`)
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async applyToLocalGFF3(backend: LocalGFF3DataStore) {}

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

  async uncompressFile(
    compressedFullFileName: string,
    uncompressedFullFileName: string,
  ) {
    // Uncompress the file
    const fileContents = createReadStream(compressedFullFileName)
    const writeStream = createWriteStream(uncompressedFullFileName)
    const unzip = createGunzip()
    fileContents.pipe(unzip).pipe(writeStream)
    fileContents.close()
    writeStream.close()
    unzip.close()
    this.logger.debug?.(
      `*** Uncompress function - file uncompressed: '${uncompressedFullFileName}'`,
    )
  }

  /**
   * Loop child features in parent feature and add featureId to each child's attribute
   * @param parentFeature - Parent feature
   */
  setAndGetFeatureIdRecursively(
    parentFeature: GFF3FeatureLineWithOptionalRefs,
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
