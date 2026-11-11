import { Duplex } from 'node:stream'
import type { ReadableWritablePair } from 'node:stream/web'
import { createGunzip } from 'node:zlib'

/**
 * Create a web transform stream that decompresses gzip data. Unlike
 * `new DecompressionStream('gzip')`, it reads every member of a multi-member
 * gzip file, such as a bgzip file. Since Node.js 26, DecompressionStream stops
 * after the first member and errors on the rest.
 * @returns a transform stream to use with `pipeThrough()`
 */
export function gunzipStream(): ReadableWritablePair<Uint8Array, Uint8Array> {
  return Duplex.toWeb(createGunzip())
}
