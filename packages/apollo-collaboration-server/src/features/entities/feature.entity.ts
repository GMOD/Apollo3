import { Types } from 'mongoose'

export interface FeatureObject {
  _id: string
  refSeq: Types.ObjectId
  allIds: string[]
  type: string
  min: number
  max: number
  strand?: 1 | -1
  attributes?: Record<string, string[]>
  children?: Map<string, FeatureObject>
  status: number
  user: string
}
