import {
  type AnnotationFeatureSnapshot,
  Check,
  type CheckResultSnapshot,
} from '@apollo-annotation/common'

export const MIN_FEATURE_LENGTH = 3

/** A random ID in the format of a MongoDB ObjectId (24 hex characters) */
function makeId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

/**
 * Flags features (at any level) shorter than a few bases. Checks get plain
 * feature snapshots, so the same check runs on the client and the server.
 */
export class ExampleShortFeatureCheck extends Check {
  name = 'ExampleShortFeatureCheck'
  version = 1
  causes = ['ExampleShortFeature']
  isDefault = false

  checkFeature(
    feature: AnnotationFeatureSnapshot,
  ): Promise<CheckResultSnapshot[]> {
    return Promise.resolve(this.findShortFeatures(feature))
  }

  private findShortFeatures(
    feature: AnnotationFeatureSnapshot,
  ): CheckResultSnapshot[] {
    const results: CheckResultSnapshot[] = []
    const { _id, max, min, refSeq } = feature
    if (max - min < MIN_FEATURE_LENGTH) {
      results.push({
        _id: makeId(),
        name: this.name,
        cause: 'ExampleShortFeature',
        ids: [_id],
        refSeq,
        start: min,
        end: max,
        message: `Feature is shorter than ${MIN_FEATURE_LENGTH} bases`,
      })
    }
    for (const child of Object.values(feature.children ?? {})) {
      results.push(...this.findShortFeatures(child))
    }
    return results
  }
}
