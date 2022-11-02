import { ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard, IAuthModuleOptions } from '@nestjs/passport'

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(
    context: ExecutionContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): IAuthModuleOptions<any> | undefined {
    const [req] = context.getArgs()
    const urlSearchParams = new URLSearchParams(req.originalUrl)
    const appURL = urlSearchParams.get('state')
    return { state: { appURL } }
  }
}
