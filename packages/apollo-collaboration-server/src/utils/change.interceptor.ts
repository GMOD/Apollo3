import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common'
import { SerializedChange, changeRegistry } from 'apollo-shared'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

@Injectable()
export class ChangeInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ChangeInterceptor.name)

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const serializedChange: SerializedChange = context
      .switchToHttp()
      .getRequest<Request>().body as any
    // const callingClass = context.getClass().name
    // const callingEndpoint = context.getHandler().name

    const ChangeType = changeRegistry.getChangeType(serializedChange.typeName)
    const change = new ChangeType(serializedChange, { logger: this.logger })

    const request = context.switchToHttp().getRequest()
    if (request.body) {
      request.body = change
      this.logger.debug(`Interceptor body '${JSON.stringify(request.body)}'`)
    }
    return next.handle().pipe(
      map((retData) => {
        return retData
      }),
    )
  }
}
