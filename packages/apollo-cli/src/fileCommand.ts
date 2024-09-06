import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  Transform,
  TransformCallback,
  TransformOptions,
  pipeline,
} from 'node:stream'

import { SingleBar } from 'cli-progress'
import { Agent, RequestInit, fetch } from 'undici'

import { ConfigError } from './ApolloConf.js'
import { BaseCommand } from './baseCommand.js'
import { createFetchErrorMessage, localhostToAddress } from './utils.js'

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
    address: string,
    accessToken: string,
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
      Authorization: `Bearer ${accessToken}`,
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
      dispatcher: new Agent({ headersTimeout: 60 * 60 * 1000 }),
      headers,
    }

    const fileName = path.basename(file)
    const url = new URL(localhostToAddress(`${address}/files`))
    url.searchParams.set('name', fileName)
    url.searchParams.set('type', type)
    progressBar.start(size, 0)
    try {
      const response = await fetch(url, init)
      if (!response.ok) {
        const errorMessage = await createFetchErrorMessage(
          response,
          'uploadFile failed',
        )
        throw new ConfigError(errorMessage)
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
}
