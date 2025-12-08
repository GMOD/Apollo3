export interface FeatureCountRequest {
  assemblyId?: string
  refSeqId?: string
  start?: number
  end?: number
}

export interface GetByIndexedIdRequest {
  id: string
  assemblies?: string
  topLevel?: boolean
}
