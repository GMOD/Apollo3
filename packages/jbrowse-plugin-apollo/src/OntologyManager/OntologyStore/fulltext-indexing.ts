import { genericEnglishStopwords } from './fulltext-stopwords'
import { OntologyDBNode } from './indexeddb-schema'

function getStringAt(obj: Record<string, unknown>, path: string[]) {
  let thing = obj
  for (const key of path) {
    thing = thing[key] as Record<string, unknown>
  }
  return String(thing)
}

export function stringToWords(text: string) {
  return text.split(/[\W_]+/).filter((w) => Boolean(w))
}

/** @returns a Set of all the words at the given JSON paths that are not stopwords */
export function getWords(node: OntologyDBNode, paths: string[][]) {
  const wordSet = new Set<string>()
  for (const path of paths) {
    const text = getStringAt(node, path)
    stringToWords(text).forEach((word) => {
      const lc = word.toLowerCase()
      if (!genericEnglishStopwords.has(lc)) {
        wordSet.add(lc)
      }
    })
  }
  return wordSet
}
