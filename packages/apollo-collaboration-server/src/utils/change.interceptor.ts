import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common'
import { SerializedChange, changeRegistry } from 'apollo-shared'
import { Observable } from 'rxjs'
import { map, tap } from 'rxjs/operators'

@Injectable()
export class ChangeInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ChangeInterceptor.name)

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    this.logger.debug(`Interceptor starts...`)

    const inputSerChange: SerializedChange = context
      .switchToHttp()
      .getRequest<Request>().body as any
    // const callingClass = context.getClass().name
    // const callingEndpoint = context.getHandler().name

    const ChangeType = changeRegistry.getChangeType(inputSerChange.typeName)
    // const change = new ChangeType(inputSerChange, { logger: this.logger })
    const change = new ChangeType(inputSerChange)

    const request = context.switchToHttp().getRequest()
    if (request.body) {
      request.body = change
      this.logger.debug(`Interceptor body '${JSON.stringify(request.body)}'`)
    }

    this.logger.debug(`Interceptor ends...`)
    return next.handle().pipe(
      map((retData) => {
        return retData
      }),
    )
  }
}
