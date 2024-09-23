import { createHash } from 'node:crypto'
import { createWriteStream, Stats } from 'node:fs'
import {
  FileHandle,
  mkdir,
  mkdtemp,
  open,
  rename,
  rmdir,
} from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'
import { createGzip, gunzip } from 'node:zlib'

import { Logger } from '@nestjs/common'
import { Request } from 'express'
import { GenericFilehandle, FilehandleOptions } from 'generic-filehandle'

interface FileUpload {
  originalname: string
  size: number
  stream: Readable
  contentEncoding?: string
}

export interface UploadedFile extends Express.Multer.File {
  checksum: string
}

export interface FileRequest extends Omit<Request, 'file'> {
  file: Partial<UploadedFile>
}

export async function writeFileAndCalculateHash(
  file: FileUpload,
  fileUploadFolder: string,
  logger: Logger,
) {
  const { contentEncoding, originalname, size, stream } = file
  await mkdir(fileUploadFolder, { recursive: true })
  logger.log(`Starting file upload: "${originalname}"`)
  const tmpDir = await mkdtemp(join(fileUploadFolder, 'upload-tmp-'))
  const tmpFileName = join(tmpDir, `${originalname}.gz`)
  logger.debug(`Uploading to temporary file "${tmpFileName}"`)

  // We calculate the md5 hash as the file is being uploaded
  const hash = createHash('md5')
  let sizeProcesed = 0
  let lastLogTime = 0
  let lastLogFraction = 0
  stream.on('data', (chunk: Buffer) => {
    hash.update(chunk)
    sizeProcesed += chunk.length
    const now = Date.now()
    if (size > 0 && now - lastLogTime > 5000) {
      const fraction = sizeProcesed / size
      if (fraction - lastLogFraction > 0.05) {
        lastLogTime = now
        lastLogFraction = fraction
        const formattedFraction = fraction.toLocaleString(undefined, {
          style: 'percent',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
        logger.debug(`File upload progress: ${formattedFraction}`)
      }
    }
    return chunk
  })

  const fileWriteStream = createWriteStream(tmpFileName)

  if (contentEncoding === 'gzip') {
    await pipeline(stream, fileWriteStream)
  } else {
    const gz = createGzip()
    await pipeline(stream, gz, fileWriteStream)
  }
  const fileChecksum = hash.digest('hex')
  logger.debug(`Uploaded file checksum: "${fileChecksum}"`)

  const uploadedFileName = join(fileUploadFolder, fileChecksum)
  logger.debug(
    `File uploaded successfully, moving temporary file to final location: "${uploadedFileName}"`,
  )
  await rename(tmpFileName, uploadedFileName)
  await rmdir(tmpDir)
  logger.log('File upload finished')
  return fileChecksum
}

async function unzip(input: FileHandle): Promise<Buffer> {
  const gunzipP = promisify(gunzip)
  const fileContents = await input.readFile()
  const unzippedContents = await gunzipP(fileContents)
  return unzippedContents
}

export class LocalFileGzip implements GenericFilehandle {
  private fileHandle: Promise<FileHandle> | undefined
  private filename: string
  private opts: FilehandleOptions

  public constructor(source: string, opts: FilehandleOptions = {}) {
    this.filename = source
    this.opts = opts
  }

  private getFileHandle(): Promise<FileHandle> {
    if (!this.fileHandle) {
      this.fileHandle = open(this.filename)
    }
    return this.fileHandle
  }

  public async read(
    buffer: Buffer,
    offset = 0,
    length: number,
    position = 0,
  ): Promise<{ bytesRead: number; buffer: Buffer }> {
    const fileHandle = await this.getFileHandle()
    const unzippedContents = await unzip(fileHandle)
    const bytesRead = unzippedContents.copy(
      buffer,
      position,
      offset,
      offset + length,
    )
    return { bytesRead, buffer }
  }

  public async readFile(): Promise<Buffer>
  public async readFile(options: BufferEncoding): Promise<string>
  public async readFile<T extends undefined>(
    options:
      | Omit<FilehandleOptions, 'encoding'>
      | (Omit<FilehandleOptions, 'encoding'> & { encoding: T }),
  ): Promise<Buffer>
  public async readFile<T extends BufferEncoding>(
    options: Omit<FilehandleOptions, 'encoding'> & { encoding: T },
  ): Promise<string>

  public async readFile(
    _options?: FilehandleOptions | BufferEncoding,
  ): Promise<Buffer | string> {
    const fileHandle = await this.getFileHandle()
    const unzippedContents = await unzip(fileHandle)
    if (this.opts.encoding) {
      return unzippedContents.toString(this.opts.encoding)
    }
    return unzippedContents
  }

  // todo memoize
  public async stat(): Promise<Stats> {
    const fh = await this.getFileHandle()
    return fh.stat()
  }

  public async close(): Promise<void> {
    const fh = await this.getFileHandle()
    return fh.close()
  }
}
