import * as mongoose from 'mongoose'

// RefSeq
export const RefSeqSchema = new mongoose.Schema({
  assemblyId: { type: String, required: true },
  description: { type: String, required: true },
  length: { type: Number, required: true }
})
export interface RefSeqModel extends mongoose.Document {
  id: string
  assemblyId: string
  description: string
  length: number
}