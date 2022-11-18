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

import { getDecodedAccessToken } from './commonUtilities'

@Injectable()
export class ChangeInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ChangeInterceptor.name)

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const serializedChange: SerializedChange = context
      .switchToHttp()
      .getRequest<Request>().body as unknown as SerializedChange
    const ChangeType = changeRegistry.getChangeType(serializedChange.typeName)
    const change = new ChangeType(serializedChange, { logger: this.logger })

    const request = context.switchToHttp().getRequest()
    // Add user's email to Change -object if it's not filled yet
    const { authorization } = request.headers
    if (!authorization) {
      throw new Error('No "authorization" header')
    }
    const [, token] = authorization.split(' ')
    const jwtPayload = getDecodedAccessToken(token)
    const { email: user } = jwtPayload

    request.body = { change, user, userToken: token }
    this.logger.debug(`Interceptor body '${JSON.stringify(request.body)}'`)
    return next.handle().pipe(map((retData) => retData))
  }
}
