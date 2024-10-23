/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// jsonpath triggers this rule for some reason. import { query } from 'jsonpath' does not work

import { checkAbortSignal } from '@jbrowse/core/util'
import jsonpath from 'jsonpath'

import { stopwords } from './fulltext-stopwords'
import { OntologyDBNode } from './indexeddb-schema'
import { applyPrefixes } from './prefixes'
import OntologyStore, { Transaction } from '.'
import { TextIndexFieldDefinition } from '../../config'

/** special value of jsonPath that gets the IRI (that is, ID) of the node with the configured prefixes applied */
export const PREFIXED_ID_PATH = '$PREFIXED_ID'

/** small wrapper for jsonpath.query that intercepts requests for the special prefixed ID path */
function jsonPathQuery(
  node: OntologyDBNode,
  path: string,
  prefixes: Map<string, string>,
) {
  if (path === PREFIXED_ID_PATH) {
    return [applyPrefixes(node.id, prefixes)]
  }
  return jsonpath.query(node, path)
}

function wordsInString(str: string) {
  return str
    .toLowerCase()
    .split(/[^\d:A-Za-z]+/)
    .filter((word) => word && !stopwords.has(word))
}

/**
 * recursively get the indexable words from an iterator
 * of any objects
 **/
export function* extractWords(
  strings: Iterable<string>,
): Generator<string, void, undefined> {
  for (const str of strings) {
    yield* wordsInString(str)
  }
}

export function* extractStrings(
  things: Iterable<unknown>,
): Generator<string, void, undefined> {
  for (const thing of things) {
    if (typeof thing === 'string') {
      yield thing
    } else if (typeof thing === 'object') {
      const members = jsonpath.query(thing, '$..*')
      yield* extractStrings(members)
    }
  }
}

/** @returns generator of tuples of [jsonpath, word] */
export function* getWords(
  node: OntologyDBNode,
  jsonPaths: Iterable<string>,
  prefixes: Map<string, string>,
): Generator<[string, string], void, undefined> {
  for (const path of jsonPaths) {
    const queryResult = jsonPathQuery(node, path, prefixes) as unknown[]
    if (queryResult.length > 0) {
      for (const word of extractWords(extractStrings(queryResult))) {
        yield [path, word]
      }
    }
  }
}

export interface Match {
  term: OntologyDBNode
  field: TextIndexFieldDefinition
  str: string
  score: number
}

export function isMatch(thing: object): thing is Match {
  return (
    'term' in thing && 'field' in thing && 'str' in thing && 'score' in thing
  )
}

/**
 *
 **/
export async function textSearch(
  this: OntologyStore,
  text: string,
  tx?: Transaction<['nodes']>,
  signal?: AbortSignal,
) {
  const db = await this.db
  const myTx = tx ?? db.transaction(['nodes'])

  checkAbortSignal(signal)

  const queryWords = [...wordsInString(text)]

  const queries: Promise<void>[] = []

  /**
   * Build a structure of which terms match which words.
   * This is a Map of term.id -\> Set\<query word number\>
   **/
  const initialMatches = new Map<string, [OntologyDBNode, Set<number>]>()

  // find startsWith and complete matches
  queries.push(
    ...queryWords.map(async (queryWord, queryWordIndex) => {
      checkAbortSignal(signal)
      const idx = myTx.objectStore('nodes').index('full-text-words')
      for await (const cursor of idx.iterate(
        IDBKeyRange.bound(queryWord, `${queryWord}\uFFFF`, false, false),
      )) {
        checkAbortSignal(signal)
        const term = cursor.value
        const termMatches = initialMatches.get(term.id) ?? [
          term,
          new Set<number>(),
        ]
        termMatches[1].add(queryWordIndex)
        initialMatches.set(term.id, termMatches)
      }
    }),
  )

  await Promise.all(queries)

  checkAbortSignal(signal)

  // now rank the term matches and add some detail
  const results: Match[] = []
  for (const [, [term, wordIndexes]] of initialMatches) {
    checkAbortSignal(signal)
    results.push(
      ...elaborateMatch(
        this.textIndexFields,
        term,
        wordIndexes,
        queryWords,
        this.prefixes,
      ),
    )
  }

  // sort the terms by score descending
  results.sort((a, b) => b.score - a.score)

  // truncate if necessary
  return results.slice(
    0,
    this.options.maxSearchResults ?? this.DEFAULT_MAX_SEARCH_RESULTS,
  )
}

export function elaborateMatch(
  textIndexPaths: TextIndexFieldDefinition[],
  term: OntologyDBNode,
  queryWordIndexes: Set<number>,
  queryWords: string[],
  prefixes: Map<string, string>,
): Match[] {
  const sortedWordIndexes = [...queryWordIndexes].sort()
  const matchedQueryWords = sortedWordIndexes.map((i) => queryWords[i])
  const queryWordRegexps = matchedQueryWords.map((queryWord) => {
    const escaped = queryWord.replaceAll(/[$()*+./?[\\\]^{|}-]/g, '\\$&')
    return new RegExp(`\\b${escaped}`, 'gi')
  })
  // const needle = matchedQueryWords.join(' ')

  // ranking weights that can be tweaked if you know what you're doing
  const FIELD_PRIORITY_WEIGHT = 1
  const MATCH_WORDS_CLOSENESS_WEIGHT = 0.05
  const MATCH_ADJACENCY_BONUS = 1
  const MATCH_RIGHT_ORDER_BONUS = 1
  const MATCH_LENGTH_WEIGHT = 0.01
  const PCT_OF_STRING_WEIGHT = 0.05
  const WORD_BONUS = 100 // bonus for each of the words matched

  // inspect the node at each of the index paths, because we don't know which ones matched
  interface WordMatch {
    wordIndex: number
    position: number
  }
  let matches: (Match & { wordMatches: WordMatch[] })[] = []
  let maxScore = 0
  for (const [fieldIdx, field] of textIndexPaths.entries()) {
    const wordsMatched = new Set<number>()
    const fieldPriorityBonus = textIndexPaths.length - fieldIdx - 1
    const termStrings = [
      ...extractStrings(jsonPathQuery(term, field.jsonPath, prefixes)),
    ]
    // find occurrences of each of the words in the strings
    for (const str of termStrings) {
      let score = 0
      const wordMatches: WordMatch[] = []
      for (const [wordIndex, re] of queryWordRegexps.entries()) {
        for (const match of str.matchAll(re)) {
          score += 1 + fieldPriorityBonus * FIELD_PRIORITY_WEIGHT
          wordsMatched.add(wordIndex)
          const position = match.index
          const queryWord = queryWords[wordIndex]
          if (position !== undefined) {
            score += queryWord.length * MATCH_LENGTH_WEIGHT
            score +=
              (queryWord.length / str.length) * 100 * PCT_OF_STRING_WEIGHT
            wordMatches.push({ wordIndex, position })
          }
        }
      }

      // apply the words-matched bonus
      score += wordsMatched.size * WORD_BONUS

      if (maxScore < score) {
        maxScore = score
      }
      // sort the word matches by position in the target string ascending
      wordMatches.sort((a, b) => a.position - b.position)
      if (wordMatches.length > 0) {
        matches.push({ term, field, str, score, wordMatches })
      }
    }
  }

  // Keep only the highest-scored matches. Usually 1, but there
  // could be multiple if there is a tie for first place.
  matches = matches.filter((m) => m.score === maxScore)

  for (const match of matches) {
    const { wordMatches } = match
    // re-examine the word order and spacing to give bonuses for the
    // right order and close spacing
    for (let i = 0; i < wordMatches.length - 1; i++) {
      // bonus for pairs with adjacent word indexes and close spacing
      const m1 = wordMatches[i]
      const m2 = wordMatches[i + 1]
      const wdiff = m2.wordIndex - m1.wordIndex
      if (wdiff === 1 || wdiff === -1) {
        // they are adjacent, bonus
        match.score += MATCH_ADJACENCY_BONUS
        if (wdiff === 1) {
          // they are in the right order, bonus
          match.score += MATCH_RIGHT_ORDER_BONUS
        }
        // give additional bonus for how close they are
        const spacing =
          Math.abs(
            m2.position -
              (m1.position + matchedQueryWords[m1.wordIndex].length),
          ) - 1
        match.score -= spacing * MATCH_WORDS_CLOSENESS_WEIGHT
      }
    }
  }

  return matches
}
