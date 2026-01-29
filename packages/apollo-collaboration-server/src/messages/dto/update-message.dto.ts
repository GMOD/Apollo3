import { PartialType } from '@nestjs/mapped-types'

import { CreateMessageDto } from './create-message.dto.js'

export class UpdateMessageDto extends PartialType(CreateMessageDto) {
  id: number
}
