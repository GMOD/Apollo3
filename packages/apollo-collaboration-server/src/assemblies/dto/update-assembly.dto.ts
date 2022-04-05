import { PartialType } from '@nestjs/mapped-types'

import { CreateAssemblyDto } from './create-assembly.dto'

export class UpdateAssemblyDto extends PartialType(CreateAssemblyDto) {}
