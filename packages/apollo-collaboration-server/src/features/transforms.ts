import {
  ReadableStream,
  type ReadableStreamDefaultReader,
  TransformStream,
} from 'node:stream/web'

import type { FeatureDocument } from '@apollo-annotation/schemas'

import type { ChecksService } from '../checks/checks.service.js'

export class CheckFeatureStream extends TransformStream<
  FeatureDocument,
  FeatureDocument
> {
  constructor(checksService: Readonly<ChecksService>) {
    super({
      async transform(chunk, controller) {
        try {
          await checksService.checkFeature(chunk)
          controller.enqueue(chunk)
        } catch (error) {
          controller.error(
            error instanceof Error ? error : new Error(String(error)),
          )
        }
      },
    })
  }
}

export class DocToJSONArrayStream<T> extends TransformStream<T, string> {
  constructor() {
    let isFirst = true
    super({
      start(controller) {
        controller.enqueue('[')
      },
      transform(chunk, controller) {
        controller.enqueue((isFirst ? '' : ',') + JSON.stringify(chunk))
        isFirst = false
      },
      flush(controller) {
        controller.enqueue(']')
      },
    })
  }
}

/**
 * Wrap a stream so it isn't created until it's first read from. Useful when
 * the stream depends on state that another stream produces first, e.g. when
 * concatenating streams.
 * @param create - creates the underlying stream
 * @returns a stream that creates and reads from the underlying stream on demand
 */
export function lazyStream<T>(create: () => ReadableStream<T>) {
  let reader: ReadableStreamDefaultReader<T> | undefined
  return new ReadableStream<T>(
    {
      async pull(controller) {
        reader ??= create().getReader()
        const { done, value } = await reader.read()
        if (done) {
          controller.close()
        } else {
          controller.enqueue(value)
        }
      },
      async cancel(reason) {
        await reader?.cancel(reason)
      },
    },
    // Without this, the stream would pull as soon as it's constructed
    { highWaterMark: 0 },
  )
}
