/* eslint-disable unicorn/prefer-structured-clone */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * Helpers for working with features as they are stored in MongoDB, used by the
 * server-side change handlers.
 */
import type { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import type { Feature } from '@apollo-annotation/schemas'
import {
  attributesToRecords,
  stringifyAttributes,
} from '@apollo-annotation/shared'
import { doesIntersect2 } from '@jbrowse/core/util'

/** Find a feature, or one of its descendants, by ID */
export function getFeatureFromId(
  feature: Feature,
  featureId: string,
): Feature | null {
  if (feature._id.equals(featureId)) {
    return feature
  }
  for (const [, childFeature] of feature.children ??
    new Map<string, Feature>()) {
    const subFeature = getFeatureFromId(childFeature, featureId)
    if (subFeature) {
      return subFeature
    }
  }
  return null
}

/** Add a child feature, keeping the children sorted by start position */
export function addChild(
  parentFeature: Feature,
  child: AnnotationFeatureSnapshot,
) {
  if (!parentFeature.attributes?._id) {
    let { attributes = {} } = parentFeature
    attributes = {
      _id: [parentFeature._id.toString()],
      ...JSON.parse(JSON.stringify(attributes)),
    }
    parentFeature.attributes = attributes
  }
  const { _id } = child
  parentFeature.children ??= new Map()
  // The plain child is cast to a subdocument when the feature is saved
  parentFeature.children.set(_id, {
    allIds: [],
    ...child,
    _id,
  } as unknown as Feature)
  // Child features should be sorted for click and drag of gene glyphs to work
  // properly
  parentFeature.children = new Map(
    [...parentFeature.children.entries()].sort((a, b) => a[1].min - b[1].min),
  )
}

/** Merge the second transcript into the first one */
export function mergeTranscripts(
  firstTranscript: Feature,
  secondTranscript: AnnotationFeatureSnapshot,
) {
  firstTranscript.min = Math.min(firstTranscript.min, secondTranscript.min)
  firstTranscript.max = Math.max(firstTranscript.max, secondTranscript.max)

  const mergedAttributes: Record<string, string[]> = firstTranscript.attributes
    ? JSON.parse(JSON.stringify(firstTranscript.attributes))
    : {}
  if (secondTranscript.attributes) {
    const { merged_with: mergedWith = [] } = mergedAttributes
    mergedWith.push(
      stringifyAttributes(attributesToRecords(secondTranscript.attributes)),
    )
    mergedAttributes.merged_with = mergedWith
  }
  firstTranscript.attributes = mergedAttributes

  if (secondTranscript.children) {
    for (const [, secondFeatureChild] of Object.entries(
      secondTranscript.children,
    )) {
      mergeFeatureIntoTranscript(secondFeatureChild, firstTranscript)
    }
  }
}

function mergeFeatureIntoTranscript(
  secondFeatureChild: AnnotationFeatureSnapshot,
  firstTranscript: Feature,
) {
  firstTranscript.children ??= new Map<string, Feature>()
  let merged = false
  let mrgChild: Feature | undefined
  let toDelete
  for (const [, firstFeatureChild] of firstTranscript.children) {
    if (!merged || !mrgChild) {
      toDelete = false
      mrgChild = firstFeatureChild
    } else {
      toDelete = true
    }
    if (
      mrgChild.type === secondFeatureChild.type &&
      mrgChild.type === firstFeatureChild.type &&
      doesIntersect2(
        secondFeatureChild.min,
        secondFeatureChild.max,
        mrgChild.min,
        mrgChild.max,
      ) &&
      doesIntersect2(
        firstFeatureChild.min,
        firstFeatureChild.max,
        mrgChild.min,
        mrgChild.max,
      )
    ) {
      mrgChild.min = Math.min(
        secondFeatureChild.min,
        mrgChild.min,
        firstFeatureChild.min,
      )
      mrgChild.max = Math.max(
        secondFeatureChild.max,
        mrgChild.max,
        firstFeatureChild.max,
      )

      mrgChild.attributes ??= {}

      const mrgChildAttr: Record<string, string[]> = JSON.parse(
        JSON.stringify(mrgChild.attributes),
      )

      const { merged_with: mergedWithAttributes = [] } = mrgChildAttr
      mrgChildAttr.merged_with = mergedWithAttributes
      mergedWithAttributes.push(
        stringifyAttributes(attributesToRecords(secondFeatureChild.attributes)),
      )

      if (toDelete) {
        const recs: Record<string, string[] | undefined> =
          firstFeatureChild.attributes
            ? JSON.parse(JSON.stringify(firstFeatureChild.attributes))
            : undefined
        mergedWithAttributes.push(stringifyAttributes(recs))
        firstTranscript.children.delete(firstFeatureChild._id.toString())
      }

      mrgChildAttr.merged_with = [...new Set(mergedWithAttributes)]
      mrgChild.attributes = mrgChildAttr
      merged = true
    }
  }

  if (merged && mrgChild && secondFeatureChild.children) {
    // Add the children of the source feature
    // (secondFeatureChild.children) to the merged feature (mrgChild)
    Object.entries(secondFeatureChild.children).map(([, child]) => {
      addChild(mrgChild, child)
    })
  }

  if (merged && mrgChild) {
    addChild(firstTranscript, mrgChild as unknown as AnnotationFeatureSnapshot)
  } else {
    // This secondFeatureChild has no overlap with any feature in the
    // receiving transcript so we add it as it is to the receiving transcript
    addChild(firstTranscript, secondFeatureChild)
  }
}
