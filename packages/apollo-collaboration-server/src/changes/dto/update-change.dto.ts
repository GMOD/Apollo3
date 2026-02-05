import { PartialType } from '@nestjs/mapped-types'

import { CreateChangeDto } from './create-change.dto.js'

export class UpdateChangeDto extends PartialType(CreateChangeDto) {}
