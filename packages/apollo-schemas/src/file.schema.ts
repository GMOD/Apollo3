import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type FileDocument = File & Document

@Schema()
export class File {
  @Prop({ required: true })
  basename: string

  @Prop({ required: true })
  checksum: string

  @Prop({ required: true, enum: ['text/x-gff3', 'text/x-fasta'] })
  type: 'text/x-gff3' | 'text/x-fasta'
}

export const FileSchema = SchemaFactory.createForClass(File)
