import { Change, SerializedChange } from '@apollo-annotation/apollo-common'
import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  Logger,
  PipeTransform,
} from '@nestjs/common'

@Injectable()
export class ParseChangePipe
  implements PipeTransform<SerializedChange, Change>
{
  private readonly logger = new Logger(ParseChangePipe.name)

  transform(value: SerializedChange, _metadata: ArgumentMetadata): Change {
    const { logger } = this
    let change: Change
    try {
      change = Change.fromJSON(value, { logger })
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : new Error(String(error)),
      )
    }
    return change
  }
}
