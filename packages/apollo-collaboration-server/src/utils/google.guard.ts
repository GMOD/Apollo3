import { ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard, IAuthModuleOptions } from '@nestjs/passport'

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(
    context: ExecutionContext,
  ): IAuthModuleOptions | undefined {
    const [req] = context.getArgs()
    const { query } = req
    const redirectUri = query.redirect_uri
    if (redirectUri) {
      return { state: { redirect_uri: redirectUri } }
    }
    return
  }
}
