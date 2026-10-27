import { createWriteStream } from 'node:fs'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { SingleBar } from 'cli-progress'
import * as tar from 'tar'
import { fetch } from 'undici'

/** Whether a URL can be downloaded, without downloading it */
export async function urlExists(url: string): Promise<boolean> {
  const response = await fetch(url, { method: 'HEAD' })
  return response.ok
}

export async function fetchJSON(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Couldn't download ${url}: ${response.status} ${response.statusText}`,
    )
  }
  return response.json()
}

/** Download a URL to a file, showing a progress bar */
export async function downloadFile(url: string, file: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(
      `Couldn't download ${url}: ${response.status} ${response.statusText}`,
    )
  }
  // A compressed response's content-length is the compressed size, but the
  // body is decompressed, so the size isn't known
  const encoding = response.headers.get('content-encoding')
  const size =
    encoding && encoding !== 'identity'
      ? 0
      : Number(response.headers.get('content-length') ?? 0)
  const progressBar = new SingleBar({
    format: size
      ? '{bar} {percentage}% | {value}/{total} bytes'
      : '{value} bytes downloaded',
    etaBuffer: 100_000_000,
  })
  progressBar.start(size, 0)
  let downloaded = 0
  const progress = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      downloaded += chunk.length
      progressBar.update(downloaded)
      callback(null, chunk)
    },
  })
  try {
    await pipeline(
      Readable.fromWeb(response.body),
      progress,
      createWriteStream(file),
    )
  } finally {
    progressBar.stop()
  }
}

/**
 * Extract a `.tar.gz` into a directory, dropping the first `strip` path
 * components. If `files` is given, only those paths are extracted.
 */
export async function extractTarGz(
  file: string,
  cwd: string,
  strip: number,
  files?: string[],
): Promise<void> {
  await tar.x({ file, cwd, strip }, files ?? [])
}

/**
 * Read one file from a `.tar.gz` without extracting it. `file` is the path
 * after dropping the first `strip` path components.
 */
export async function readFileFromTarGz(
  tarball: string,
  file: string,
  strip: number,
): Promise<string | undefined> {
  let contents: string | undefined
  await tar.t({
    file: tarball,
    filter: (entryPath) => entryPath.split('/').slice(strip).join('/') === file,
    onReadEntry: (entry) => {
      const chunks: Buffer[] = []
      entry.on('data', (chunk: Buffer) => chunks.push(chunk))
      entry.on('end', () => {
        contents = Buffer.concat(chunks).toString('utf8')
      })
    },
  })
  return contents
}
