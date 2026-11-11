import { text } from 'node:stream/consumers'
import { ReadableStream } from 'node:stream/web'

import { jest } from '@jest/globals'

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

  // A consumer such as Nest's StreamableFile only attaches its error handler
  // once it starts reading. An error emitted before then has no listener and
  // crashes the process.
  it("doesn't read any stream until the combined stream is read", async () => {
    const streams = [streamOf('a'), streamOf('b')]
    const combined = concatStreams(streams)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(streams.map((stream) => stream.locked)).toEqual([false, false])
    await expect(text(combined)).resolves.toBe('ab')
  })

  it("doesn't emit an error until the combined stream is read", async () => {
    const combined = concatStreams([streamOf('a'), erroringStream('second')])
    const onError = jest.fn()
    combined.on('error', onError)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(onError).not.toHaveBeenCalled()
    await expect(text(combined)).rejects.toThrow('second')
  })

  it('cancels the streams that were not read when destroyed early', async () => {
    const cancel = jest.fn<() => void>()
    const unread = new ReadableStream<string>({ cancel })
    const combined = concatStreams([streamOf('a', 'b'), unread])
    combined.destroy()
    await new Promise((resolve) => combined.once('close', resolve))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(cancel).toHaveBeenCalled()
  })
})
