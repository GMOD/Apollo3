import { PartialType } from '@nestjs/mapped-types'

import { CreateFeatureDto } from './create-feature.dto.js'

export class UpdateFeatureDto extends PartialType(CreateFeatureDto) {}
