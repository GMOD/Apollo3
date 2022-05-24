import { GFF3Feature } from '@gmod/gff'
import { FeatureDocument, RefSeqDocument } from 'apollo-schemas'
import { ClientSession, Model } from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

import { GFF3FeatureLineWithFeatureIdAndOptionalRefs } from './FeatureChange'

export async function addFeatureIntoDb(
  gff3Feature: GFF3Feature,
  session: ClientSession,
  featureModel: Model<FeatureDocument>,
  refSeqModel: Model<RefSeqDocument>,
  assemblyId: string,
  logger: import('@nestjs/common').LoggerService,
) {
  for (const featureLine of gff3Feature) {
    const refName = featureLine.seq_id
    if (!refName) {
      throw new Error(
        `Valid seq_id not found in feature ${JSON.stringify(featureLine)}`,
      )
    }
    const refSeqDoc = await refSeqModel
      .findOne({ assembly: assemblyId, name: refName })
      .session(session)
      .exec()
    if (!refSeqDoc) {
      throw new Error(
        `RefSeq was not found by assemblyId "${assemblyId}" and seq_id "${refName}" not found`,
      )
    }
    // Let's add featureId to parent feature
    const featureId = uuidv4()
    const featureIds = [featureId]
    logger.verbose?.(
      `Adding new FeatureId: value=${JSON.stringify(featureLine)}`,
    )

    // Let's add featureId to each child recursively
    setAndGetFeatureIdRecursively({ ...featureLine, featureId }, featureIds)
    logger.verbose?.(`So far apollo ids are: ${featureIds.toString()}\n`)

    // Add into Mongo
    const [newFeatureDoc] = await featureModel.create(
      [
        {
          refSeq: refSeqDoc._id,
          featureId,
          featureIds,
          ...featureLine,
        },
      ],
      { session },
    )
    logger.verbose?.(`Added docId "${newFeatureDoc._id}"`)
  }
}

/**
 * Loop child features in parent feature and add featureId to each child's attribute
 * @param parentFeature - Parent feature
 */
export function setAndGetFeatureIdRecursively(
  parentFeature: GFF3FeatureLineWithFeatureIdAndOptionalRefs,
  featureIdArrAsParam: string[],
): string[] {
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
          setAndGetFeatureIdRecursively(newChildFeature, featureIdArrAsParam)
          return newChildFeature
        }),
    )
  }
  return featureIdArrAsParam
}
