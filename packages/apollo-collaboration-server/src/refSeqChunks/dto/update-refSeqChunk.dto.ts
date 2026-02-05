import { PartialType } from '@nestjs/mapped-types'

import { CreateRefSeqChunkDto } from './create-refSeqChunk.dto.js'

export class UpdateRefSeqChunkDto extends PartialType(CreateRefSeqChunkDto) {}
