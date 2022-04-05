import { PartialType } from '@nestjs/mapped-types'

import { CreateRefSeqDto } from './create-refSeq.dto'

export class UpdateRefSeqDto extends PartialType(CreateRefSeqDto) {}
