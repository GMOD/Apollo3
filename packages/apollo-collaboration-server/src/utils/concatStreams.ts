import { Readable } from 'node:stream'
import type { ReadableStream } from 'node:stream/web'

/**
 * Concatenate web streams into a single Node stream. Nothing is read from the
 * given streams until the combined stream is read, so an error in one of them
 * can't be emitted before the consumer attaches its error handler. (Nest's
 * StreamableFile only attaches it once it starts sending the response, and an
 * error emitted with no listener crashes the process.)
 * @param webStreams - streams to concatenate, in order
 * @returns the combined stream
 */
export function concatStreams(webStreams: ReadableStream[]): Readable {
  async function* concat() {
    for (const stream of webStreams) {
      yield* stream
    }
  }
  const combinedStream = Readable.from(concat(), { objectMode: false })
  // If the combined stream errored or was destroyed before it was fully read,
  // cancel the given streams so they release their resources (e.g. database
  // cursors). Cancelling a stream that's already done has no effect.
  combinedStream.once('close', () => {
    void Promise.allSettled(webStreams.map((stream) => stream.cancel()))
  })
  return combinedStream
}
