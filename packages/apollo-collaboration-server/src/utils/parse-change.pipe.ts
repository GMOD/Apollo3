import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common'
import { Change, SerializedChange } from 'apollo-shared'

@Injectable()
export class ParseChangePipe
  implements PipeTransform<SerializedChange, Change>
{
  transform(value: SerializedChange, _metadata: ArgumentMetadata): Change {
    let change: Change
    try {
      change = Change.fromJSON(value)
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : new Error(String(error)),
      )
    }
    return change
  }
}
