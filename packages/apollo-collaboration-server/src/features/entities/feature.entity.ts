import { Types } from 'mongoose'

export interface FeatureObject {
  _id: string
  gffId: string
  refSeq: Types.ObjectId
  allIds: string[]
  type: string
  start: number
  end: number
  discontinuousLocations?: { start: number; end: number; phase?: 0 | 1 | 2 }[]
  strand?: 1 | -1
  score?: number
  phase?: 0 | 1 | 2
  attributes?: Record<string, string[]>
  children?: Map<string, FeatureObject>
  status: number
  user: string
}
