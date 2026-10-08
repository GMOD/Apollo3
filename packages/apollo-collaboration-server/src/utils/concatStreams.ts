import { Readable } from 'node:stream'
import type { ReadableStream } from 'node:stream/web'

import StreamConcat from 'stream-concat'

/**
 * Concatenate web streams into a single Node stream. StreamConcat doesn't
 * listen for errors on the streams it's given, so an error in one of them would
 * be unhandled and crash the process. Instead, forward it to the combined
 * stream so the consumer can handle it.
 * @param webStreams - streams to concatenate, in order
 * @returns the combined stream
 */
export function concatStreams(webStreams: ReadableStream[]): Readable {
  const streams = webStreams.map((stream) => Readable.fromWeb(stream))
  const combinedStream: Readable = new StreamConcat(streams)
  for (const stream of streams) {
    stream.on('error', (error) => {
      combinedStream.destroy(error)
    })
  }
  combinedStream.on('close', () => {
    for (const stream of streams) {
      stream.destroy()
    }
  })
  return combinedStream
}
