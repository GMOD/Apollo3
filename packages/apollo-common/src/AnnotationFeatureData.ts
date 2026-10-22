/**
 * Plain data shapes for annotation features and check results, shared by the
 * client and the server. They don't depend on MobX-State-Tree or MongoDB, so
 * they can be used from any plugin.
 */

/** A plain annotation feature, e.g. a snapshot of a client-side feature */
export interface AnnotationFeatureSnapshot {
  _id: string
  /** Unique ID of the reference sequence on which this feature is located */
  refSeq: string
  /** Type of feature, usually a Sequence Ontology term, e.g. "gene" */
  type: string
  /** Start of the feature in interbase (0-based half-open) coordinates */
  min: number
  /** End of the feature in interbase (0-based half-open) coordinates */
  max: number
  /** `1` for the positive strand, `-1` for the negative strand */
  strand?: 1 | -1
  /** Child features of this feature, keyed by their `_id` */
  children?: Record<string, AnnotationFeatureSnapshot>
  /** Additional attributes of the feature, e.g. name, note, dbxref */
  attributes?: Record<string, readonly string[] | undefined>
}

/** The result of a {@link Check} finding a problem with a feature */
export interface CheckResultSnapshot {
  _id: string
  /** The name of the check that produced this result */
  name: string
  /** Which of the check's `causes` this result is for */
  cause: string
  /** IDs of the features this result applies to */
  ids: string[]
  refSeq: string
  start: number
  end: number
  ignored?: boolean
  message: string
}

/**
 * The minimal shape of a feature tree that helpers like
 * `FeatureChange.getChildFeatureIds` need. Satisfied by plain snapshots
 * (children in an object) and by features stored on the server (children in a
 * `Map`).
 */
export interface FeatureNode {
  attributes?:
    | Map<string, readonly string[] | undefined>
    | Record<string, readonly string[] | undefined>
  children?: Map<string, FeatureNode> | Record<string, FeatureNode>
}
