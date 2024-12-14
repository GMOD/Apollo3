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
 * compact the given URI using the given prefixes
 */
export function applyPrefixes(
  uri: string,
  prefixes: Map<string | number, string>,
) {
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
export function expandPrefixes(
  uri: string,
  prefixes: Map<string | number, string>,
) {
  for (const [prefix, uriBase] of prefixes.entries()) {
    if (uri.startsWith(String(prefix))) {
      return uri.replace(String(prefix), uriBase)
    }
  }
  return uri
}
