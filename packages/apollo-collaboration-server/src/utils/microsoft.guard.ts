/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { type ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard, type IAuthModuleOptions } from '@nestjs/passport'

@Injectable()
export class MicrosoftAuthGuard extends AuthGuard('microsoft') {
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
