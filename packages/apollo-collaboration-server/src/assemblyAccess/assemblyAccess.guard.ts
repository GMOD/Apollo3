import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'

import { type RequestUser, getRequestUser } from '../utils/requestWithUser.js'

import {
  ASSEMBLY_ACCESS_KEY,
  type AssemblyAccessSpec,
} from './assemblyAccess.decorator.js'
import { AssemblyAccessService } from './assemblyAccess.service.js'

/** A serialized change, as it looks before ParseChangePipe runs */
interface RawChange {
  typeName?: string
  assembly?: string
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

/**
 * Rejects requests naming an assembly, refSeq or feature the user is not
 * allowed to reach, based on the `@AssemblyAccess` metadata of the handler.
 *
 * Denials are 404 rather than 403 on purpose. The client's fetcher discards the
 * stored token and retries whenever it sees a 403, so a 403 here would log
 * restricted users out in a loop. 404 also avoids disclosing whether an
 * assembly exists.
 */
@Injectable()
export class AssemblyAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly assemblyAccessService: AssemblyAccessService,
  ) {}

  private readonly logger = new Logger(AssemblyAccessGuard.name)

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const specs = this.reflector.getAllAndOverride<
      AssemblyAccessSpec[] | undefined
    >(ASSEMBLY_ACCESS_KEY, [context.getHandler(), context.getClass()])
    if (!specs || specs.length === 0) {
      return true
    }
    const request = context.switchToHttp().getRequest<Request>()
    const user = getRequestUser(request)
    // Resolved once and threaded through the checks below. Users who are not
    // restricted at all skip every one of them, including the "a required id
    // must be present" check.
    const allowed = await this.assemblyAccessService.getAllowedAssemblyIds(user)
    if (!allowed) {
      return true
    }

    for (const spec of specs) {
      if (spec.kind === 'change') {
        this.checkChange(allowed, user, request)
        continue
      }
      const ids = this.extractIds(request, spec)
      if (ids.length === 0) {
        if (spec.optional) {
          continue
        }
        this.deny(user, `missing ${spec.kind} id`)
      }
      for (const id of ids) {
        if (
          !(await this.assemblyAccessService.canAccess(allowed, spec.kind, id))
        ) {
          this.deny(user, `${spec.kind} "${id}"`)
        }
      }
    }
    return true
  }

  private checkChange(
    allowedAssemblyIds: string[],
    user: RequestUser | undefined,
    request: Request,
  ) {
    // Guards run before pipes, so the body is still plain JSON here rather than
    // a Change instance
    const body = (request.body ?? {}) as RawChange
    const change = {
      assembly: readString(body.assembly),
      typeName: readString(body.typeName),
    }
    if (
      !this.assemblyAccessService.canSubmitChange(allowedAssemblyIds, change)
    ) {
      this.deny(
        user,
        `change "${change.typeName ?? 'unknown'}" on assembly "${change.assembly ?? 'unknown'}"`,
      )
    }
  }

  private extractIds(request: Request, spec: AssemblyAccessSpec): string[] {
    const { in: location = 'query', key } = spec
    if (!key) {
      return []
    }
    let source: unknown
    switch (location) {
      case 'params': {
        source = request.params
        break
      }
      case 'body': {
        source = request.body
        break
      }
      default: {
        source = request.query
      }
    }
    const value = (source as Record<string, unknown> | undefined)?.[key]
    if (value === undefined || value === null) {
      return []
    }
    const values = Array.isArray(value) ? value : [value]
    const ids: string[] = []
    for (const entry of values) {
      const asString = readString(entry)
      if (asString === undefined) {
        continue
      }
      // Several endpoints take a comma-separated list of assembly ids
      const parts = spec.list ? asString.split(',') : [asString]
      for (const part of parts) {
        const trimmed = part.trim()
        if (trimmed) {
          ids.push(trimmed)
        }
      }
    }
    return ids
  }

  private deny(user: RequestUser | undefined, what: string): never {
    this.logger.warn(
      `User "${user?.email ?? 'anonymous'}" is not allowed to access ${what}`,
    )
    throw new NotFoundException('Not found')
  }
}
