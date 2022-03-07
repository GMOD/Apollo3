import { GFF3Item } from '@gmod/gff'
import * as mongoose from 'mongoose'

export const GFF3Schema = new mongoose.Schema({
  apolloId: { type: [], required: true },
  gff3Item: { type: JSON, required: true },
})

export interface GFF3Model extends mongoose.Document {
  id: string
  apolloId: string[]
  gff3Item: GFF3Item
}
