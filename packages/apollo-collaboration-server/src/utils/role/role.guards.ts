import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import jwtDecode from 'jwt-decode'

import { PayloadObject } from '../payloadObject'
import { ROLES_KEY } from './role.decorator'
import { Role } from './role.enum'

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly jwtService: JwtService
  private readonly logger = new Logger(RolesGuard.name)

  constructor(private reflector: Reflector) {}

  /**
   * Check if user belongs to such group that user is allowed to execute endpoint
   * @param context
   * @returns TRUE: user is allowed to execute endpoint
   *          FALSE: user is not allowed to execute endpoint
   */
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    try {
      this.logger.verbose(`Required roles are =${requiredRoles}=`)
      // If no role was required in endpoint then return true
      if (!requiredRoles) {
        return true
      }

      // Get header and payload object containing username and userid
      const req = context.switchToHttp().getRequest()
      const authHeader = req.headers.authorization
      const token = authHeader.split(' ')
      const payloadObject: PayloadObject = this.getDecodedAccessToken(token[1])

      this.logger.verbose(
        `Extracted from token, username =${payloadObject.username}=`,
      )
      // this.logger.debug('RolesGuard handler=' + context.getHandler());

      // TODO: Check from database if user has required role
      for (const point of requiredRoles) {
        this.logger.verbose(`Role =${point}=`)
      }
      if (payloadObject.username === 'john') {
        return true
      } // TODO: Remove hard-coded check

      return false
    } catch (Exception) {
      this.logger.error(Exception)
      return false
    }
  }

  /**
   * Decode access token
   * @param token
   * @returns Decoded token or null
   */
  getDecodedAccessToken(token: string): any {
    try {
      return jwtDecode(token)
    } catch (Error) {
      return null
    }
  }
}
