import { PartialType } from '@nestjs/mapped-types'

import { CreateRefSeqChunkDto } from './create-refSeqChunk.dto'

export class UpdateRefSeqChunkDto extends PartialType(CreateRefSeqChunkDto) {}
