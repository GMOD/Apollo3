/**
 * This file contains stuff dealing with IRI prefixes used in ontologies.
 *
 * ```
 * const prefixes = new Map(['GO:', 'http://long.url/GO_'])
 *
 * applyPrefixes('http://long.url/GO_1234345') // returns 'GO:1234345'
 *
 * expandPrefixes('GO:1234345') // returns 'http://long.url/GO_1234345'
 * ```
 */

/**
 * Mirrors the read-only subset of IMSTMap's API these functions need.
 * IMSTMap doesn't extend Map and its entries() predates TypeScript's
 * Iterator Helper additions to Map's types, so it no longer structurally
 * satisfies Map\<K, V\>.
 */
interface PrefixEntries {
  entries(): IterableIterator<[string | number, string]>
}

/**
 * compact the given URI using the given prefixes
 */
export function applyPrefixes(uri: string, prefixes: PrefixEntries) {
  for (const [prefix, uriBase] of prefixes.entries()) {
    if (uri.startsWith(uriBase)) {
      return uri.replace(uriBase, String(prefix))
    }
  }
  return uri
}

/**
 * expand the given compacted URI using given prefixes
 */
export function expandPrefixes(uri: string, prefixes: PrefixEntries) {
  for (const [prefix, uriBase] of prefixes.entries()) {
    if (uri.startsWith(String(prefix))) {
      return uri.replace(String(prefix), uriBase)
    }
  }
  return uri
}
