import { text } from 'node:stream/consumers'
import { ReadableStream } from 'node:stream/web'

import { concatStreams } from './concatStreams.js'

function streamOf(...chunks: string[]) {
  return new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk)
      }
      controller.close()
    },
  })
}

function erroringStream(message: string) {
  return new ReadableStream<string>({
    pull(controller) {
      controller.error(new Error(message))
    },
  })
}

describe('concatStreams', () => {
  it('concatenates streams in order', async () => {
    const combined = concatStreams([streamOf('a', 'b'), streamOf('c')])
    await expect(text(combined)).resolves.toBe('abc')
  })

  it('forwards an error from the current stream', async () => {
    const combined = concatStreams([erroringStream('first'), streamOf('b')])
    await expect(text(combined)).rejects.toThrow('first')
  })

  it('forwards an error from a stream that is not yet being read', async () => {
    const combined = concatStreams([streamOf('a'), erroringStream('second')])
    await expect(text(combined)).rejects.toThrow('second')
  })
})
