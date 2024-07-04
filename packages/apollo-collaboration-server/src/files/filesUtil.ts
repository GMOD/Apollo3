import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, rename, rmdir } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'

import { Logger } from '@nestjs/common'

interface FileUpload {
  originalname: string
  size: number
  stream: Readable
}

export async function writeFileAndCalculateHash(
  file: FileUpload,
  fileUploadFolder: string,
  logger: Logger,
) {
  const { originalname, size, stream } = file
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
