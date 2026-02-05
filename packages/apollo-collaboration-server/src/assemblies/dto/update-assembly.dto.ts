import { PartialType } from '@nestjs/mapped-types'

import { CreateAssemblyDto } from './create-assembly.dto.js'

export class UpdateAssemblyDto extends PartialType(CreateAssemblyDto) {}
