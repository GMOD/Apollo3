import type { Readable } from 'node:stream'

import type { Cursor } from 'mongoose'

/**
 * mongoose's Cursor<T> extends Node's Readable at runtime, but its bundled
 * types predate TypeScript's newer AsyncIterator/[Symbol.asyncDispose]
 * additions (pulled in unconditionally by \@types/node), so it no longer
 * structurally satisfies Readable. This narrows it back for use with
 * Readable-based APIs like Readable.toWeb().
 */
export function cursorToReadable<T, O>(cursor: Cursor<T, O>): Readable {
  return cursor as unknown as Readable
}
