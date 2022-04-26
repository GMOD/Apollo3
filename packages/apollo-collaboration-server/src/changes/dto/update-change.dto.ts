import { PartialType } from '@nestjs/mapped-types'

import { CreateChangeDto } from './create-change.dto'

export class UpdateChangeDto extends PartialType(CreateChangeDto) {}
