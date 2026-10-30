export interface FeatureCountRequest {
  assemblyId?: string
  refSeqId?: string
  start?: number
  end?: number
}

/** Query parameters arrive as strings */
export interface FeatureDensityRequest {
  refSeq: string
  start: string
  end: string
  binSize: string
  /** Only count top-level features of these types. Repeat for more types. */
  type?: string | string[]
}

export interface GetByIndexedIdRequest {
  id: string
  assemblies?: string
  topLevel?: boolean
}
