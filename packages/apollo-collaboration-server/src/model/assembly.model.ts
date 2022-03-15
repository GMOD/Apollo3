import * as mongoose from 'mongoose'

// Assembly
export const AssemblySchema = new mongoose.Schema({
  description: { type: String, required: true },
})
export interface AssemblyModel extends mongoose.Document {
  id: string
  description: string
}
