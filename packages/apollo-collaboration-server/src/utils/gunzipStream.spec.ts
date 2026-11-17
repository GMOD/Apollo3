import { text } from 'node:stream/consumers'
import { ReadableStream } from 'node:stream/web'
import { gzipSync } from 'node:zlib'

import { gunzipStream } from './gunzipStream.js'

function streamOf(data: Uint8Array) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data)
      controller.close()
    },
  })
}

describe('gunzipStream', () => {
  it('decompresses a single gzip member', async () => {
    const stream = streamOf(gzipSync('>ctgA\nACGT\n')).pipeThrough(
      gunzipStream(),
    )
    expect(await text(stream)).toBe('>ctgA\nACGT\n')
  })

  it('decompresses every member of a multi-member (e.g. bgzip) file', async () => {
    const data = Buffer.concat([
      gzipSync('>ctgA\nACGT\n'),
      gzipSync('>ctgB\nTTGA\n'),
      // bgzip files end with an empty member
      gzipSync(''),
    ])
    const stream = streamOf(data).pipeThrough(gunzipStream())
    expect(await text(stream)).toBe('>ctgA\nACGT\n>ctgB\nTTGA\n')
  })

  it('errors on data that is not gzip', async () => {
    const stream = streamOf(Buffer.from('not gzip')).pipeThrough(gunzipStream())
    await expect(text(stream)).rejects.toThrow()
  })
})
