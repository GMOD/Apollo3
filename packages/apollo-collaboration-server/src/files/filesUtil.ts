import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, rename, rmdir } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'

import { Logger } from '@nestjs/common'

export async function writeFileAndCalculateHash(
  fileUploadFolder: string,
  fileName: string,
  stream: Readable,
  logger: Logger,
) {
  await mkdir(fileUploadFolder, { recursive: true })
  logger.log(`Starting file upload: "${fileName}"`)
  const tmpDir = await mkdtemp(join(fileUploadFolder, 'upload-tmp-'))
  const tmpFileName = join(tmpDir, `${fileName}.gz`)
  logger.debug(`Uploading to temporary file "${tmpFileName}"`)

  // We calculate the md5 hash as the file is being uploaded
  const hash = createHash('md5')
  stream.on('data', (chunk) => {
    hash.update(chunk, 'utf8')
    return chunk
  })

  const fileWriteStream = createWriteStream(tmpFileName)
  const gz = createGzip()
  await pipeline(stream, gz, fileWriteStream)

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
