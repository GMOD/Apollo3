import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common'
import { Observable } from 'rxjs'

import { FilesService } from './files.service.js'
import type { FileRequest } from './filesUtil.js'

@Injectable()
export class FilesInterceptor<T> implements NestInterceptor<T, T> {
  constructor(private readonly filesService: FilesService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Promise<Observable<T>> {
    const ctx = context.switchToHttp()
    const request = ctx.getRequest<FileRequest>()
    const { headers, query } = request
    const { name } = query
    const contentLength = headers['content-length']
    const contentType = headers['content-type']
    if (contentType?.includes('multipart/form-data')) {
      return next.handle()
    }
    if (typeof name !== 'string') {
      throw new TypeError('Must provide a single file name')
    }
    let size = contentLength ? Number.parseInt(contentLength, 10) : 0
    size = Number.isNaN(size) ? 0 : size
    const checksum = await this.filesService.uploadFileFromRequest(
      request,
      name,
      size,
    )
    request.file = { originalname: name, checksum, size }
    return next.handle()
  }
}
