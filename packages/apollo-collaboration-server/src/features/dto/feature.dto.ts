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
}

export interface GetByIndexedIdRequest {
  id: string
  assemblies?: string
  topLevel?: boolean
}
