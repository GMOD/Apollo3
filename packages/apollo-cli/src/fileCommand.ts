import * as fs from 'node:fs'
import path from 'node:path'
import {
  Transform,
  type TransformCallback,
  type TransformOptions,
  pipeline,
} from 'node:stream'

import { SingleBar } from 'cli-progress'
import { type RequestInit, Headers } from 'undici'

import { BaseCommand } from './baseCommand.js'
import { createFetchErrorMessage } from './utils.js'

interface ProgressTransformOptions extends TransformOptions {
  progressBar: SingleBar
}

class ProgressTransform extends Transform {
  private size = 0

  private progressBar: SingleBar

  constructor(opts: ProgressTransformOptions) {
    super(opts)
    this.progressBar = opts.progressBar
  }

  _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    this.size += chunk.length
    this.progressBar.update(this.size)
    callback(null, chunk)
  }
}

export abstract class FileCommand extends BaseCommand<typeof FileCommand> {
  public async init(): Promise<void> {
    await super.init()
  }

  public async uploadFile(
    file: string,
    type: string,
    isGzip: boolean,
  ): Promise<string> {
    const filehandle = await fs.promises.open(file)
    const { size } = await filehandle.stat()
    const stream = filehandle.createReadStream()
    const progressBar = new SingleBar({ etaBuffer: 100_000_000 })
    const progressTransform = new ProgressTransform({ progressBar })
    const body = pipeline(stream, progressTransform, (error) => {
      if (error) {
        progressBar.stop()
        console.error('Error processing file.', error)
        throw error
      }
    })

    const headers = new Headers({
      'Content-Type': type,
      'Content-Length': String(size),
    })
    if (isGzip) {
      headers.append('Content-Encoding', 'gzip')
    }

    const init: RequestInit = {
      method: 'POST',
      body,
      duplex: 'half',
      headers,
    }

    const fileName = path.basename(file)
    const searchParams = new URLSearchParams({ name: fileName, type })
    progressBar.start(size, 0)
    try {
      const response = await this.fetch(
        `files?${searchParams.toString()}`,
        init,
      )
      if (!response.ok) {
        const errorMessage = await createFetchErrorMessage(
          response,
          'uploadFile failed',
        )
        throw new Error(errorMessage)
      }
      const json = (await response.json()) as object
      return json['_id' as keyof typeof json]
    } catch (error) {
      console.error(error)
      throw error
    } finally {
      progressBar.stop()
    }
  }

  async isFileId(x: string) {
    if (x.length != 24) {
      return false
    }
    const json = (await this.get('files')) as object[]
    for (const fileDoc of json) {
      if (fileDoc['_id' as keyof typeof fileDoc] === x) {
        return true
      }
    }
    return false
  }
}
