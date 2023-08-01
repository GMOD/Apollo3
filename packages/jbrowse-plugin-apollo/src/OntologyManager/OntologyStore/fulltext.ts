import { checkAbortSignal } from '@jbrowse/core/util'

import { stopwords } from './fulltext-stopwords'
import { OntologyDBNode } from './indexeddb-schema'
import OntologyStore, { Transaction } from '.'
import { OntologyTerm } from '..'

function getStringAt(obj: Record<string, unknown>, path: string[]) {
  let thing = obj
  for (const key of path) {
    thing = thing[key] as Record<string, unknown>
  }
  return String(thing)
}

/**
 * get the indexable words from a string of text.
 * Lowercases the string and filters out stopwords
 **/
export function stringToWords(text: string) {
  return text
    .toLowerCase()
    .split(/[\W_]+/)
    .filter((w) => Boolean(w) && !stopwords.has(w))
}

/** @returns a Set of all the words at the given JSON paths that are not stopwords */
export function getWords(node: OntologyDBNode, paths: string[][]) {
  const wordSet = new Set<string>()
  for (const path of paths) {
    const text = getStringAt(node, path)
    stringToWords(text).forEach((word) => {
      wordSet.add(word)
    })
  }
  return wordSet
}

/**
 * @returns array of terms and a match score, as
 * `[score, OntologyTerm][]`, sorted by score descending
 **/
export async function getTermsByFulltext(
  this: OntologyStore,
  text: string,
  tx?: Transaction<['nodes']>,
  signal?: AbortSignal,
) {
  const myTx = tx ?? (await this.db).transaction(['nodes'])
  const queryWords = stringToWords(text)
    .map((w) => w.toLowerCase())
    .filter((w) => !stopwords.has(w))

  const termsAndScores = new (class ScoreSheet extends Map<
    string,
    [number, OntologyTerm]
  > {
    incrementScore(term: OntologyTerm, amount: number) {
      const curr = this.get(term.id)
      if (curr) {
        curr[0] += amount
      } else {
        termsAndScores.set(term.id, [amount, term])
      }
    }
  })()

  const queries: Promise<void>[] = []

  // find startsWith and complete matches
  queries.push(
    ...queryWords.map(async (queryWord, queryWordIndex) => {
      checkAbortSignal(signal)
      const idx = myTx.objectStore('nodes').index('full-text-words')
      for await (const cursor of idx.iterate(
        IDBKeyRange.bound(queryWord, `${queryWord}\uffff`, false, false),
      )) {
        checkAbortSignal(signal)
        const term = cursor.value
        const termWords = term.fullTextWords ?? []
        // const matches = term.fullTextWords
        //   ?.filter((termWord) => termWord.startsWith(queryWord))
        //   .map((termWord, te) => queryWord.length / termWord.length)

        type Match = [
          /** matching word index */
          number,
          /** match score */
          number,
        ]
        const matches: Match[] = []
        for (let i = 0; i < termWords.length; i++) {
          const termWord = termWords[i]
          if (termWord.startsWith(queryWord)) {
            const match: Match = [i, queryWord.length / termWord.length]
            // check if the previous word also matches and count it 2X if so.
            // this should surface matches with the correct word order
            if (i > 0 && queryWordIndex > 0) {
              const previousQueryWord = queryWords[queryWordIndex - 1]
              for (let j = i - 1; j >= 0; j--) {
                const previousTermWord = termWords[j]
                if (previousTermWord.startsWith(previousQueryWord)) {
                  match[1] +=
                    2 * (previousQueryWord.length / previousTermWord.length)
                  // provide additional bonus if adjacent
                  if (i - j === 1) {
                    match[1] += 1
                  }
                  break
                }
              }
            }
            matches.push(match)
          }
        }

        if (matches?.length) {
          // score will be between 0 and 1
          termsAndScores.incrementScore(
            term,
            Math.max(...matches.map((m) => m[1])),
          )
        }
      }
    }),
  )

  await Promise.all(queries)

  const results = Array.from(termsAndScores.values())
  // normalize the scores by number of words
  for (const result of results) {
    result[0] /= queryWords.length
  }
  // sort the terms by score descending
  results.sort((a, b) => b[0] - a[0])

  // truncate if necessary
  return results.slice(
    0,
    this.options.maxSearchResults ?? this.DEFAULT_MAX_SEARCH_RESULTS,
  )
}
