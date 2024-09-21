import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type FileDocument = File & Document

@Schema()
export class File {
  @Prop({ required: true })
  basename: string

  @Prop({ required: true })
  checksum: string

  @Prop({
    required: true,
    enum: [
      'text/x-gff3',
      'text/x-fasta',
      'application/x-bgzip-fasta',
      'text/x-fai',
      'application/x-gzi',
    ],
  })
  type:
    | 'text/x-gff3'
    | 'text/x-fasta'
    | 'application/x-bgzip-fasta'
    | 'text/x-fai'
    | 'application/x-gzi'
}

export const FileSchema = SchemaFactory.createForClass(File)
