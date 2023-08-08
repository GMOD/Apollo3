import { describe, expect, it } from '@jest/globals'

import {
  PREFIXED_ID_PATH,
  elaborateMatch,
  extractWords,
  getWords,
} from './fulltext'
import { OntologyDBNode } from './indexeddb-schema'

const testNode: OntologyDBNode = {
  id: 'http://purl.obolibrary.org/obo/SO_0000001',
  lbl: 'region',
  type: 'CLASS',
  meta: {
    definition: {
      val: 'A sequence_feature with an extent greater than zero. A nucleotide region is composed of bases and a polypeptide region is composed of amino acids. It may also be termed a region of some number of nucleotides.',
      xrefs: ['SO:ke'],
    },
    subsets: ['http://purl.obolibrary.org/obo/so#SOFA'],
    synonyms: [
      {
        pred: 'hasExactSynonym',
        val: 'sequence',
      },
    ],
    basicPropertyValues: [
      {
        pred: 'http://www.geneontology.org/formats/oboInOwl#hasOBONamespace',
        val: 'sequence',
      },
    ],
  },
}

const prefixes = new Map<string, string>([
  ['SO:', 'http://purl.obolibrary.org/obo/SO_'],
])

describe('extractWords', () => {
  it('can words from the members of objects', () => {
    const result = extractWords(['bar baz', 'noggin'])
    expect(Array.from(result)).toEqual(['bar', 'baz', 'noggin'])
  })
  it('can get the words from mix of stuff', () => {
    const set = extractWords(['zoz-zoo', 'bar baz', 'noggin', 'twenty'])
    expect(Array.from(set)).toEqual([
      'zoz',
      'zoo',
      'bar',
      'baz',
      'noggin',
      'twenty',
    ])
  })
})

describe('getWords', () => {
  it('can get the words from a test node', () => {
    const result = getWords(
      testNode,
      [
        PREFIXED_ID_PATH,
        '$.lbl',
        '$.meta.definition.val',
        '$.meta.synonyms[*].val',
      ],
      prefixes,
    )
    expect([...result]).toMatchSnapshot()
  })
})

describe('elaborateMatch', () => {
  it('can do one', () => {
    const result = elaborateMatch(
      [
        { displayName: 'label', jsonPath: '$.lbl' },
        { displayName: 'synonym', jsonPath: '$.meta.synonyms[*].val' },
        { displayName: 'definition', jsonPath: '$.meta.definition.val' },
      ],
      testNode,
      new Set([1, 2]),
      ['zonk', 'nucleotide', 'region'],
      prefixes,
    )
    expect(result.length).toBe(1)
    expect(result).toMatchSnapshot()
  })
  it('can do another', () => {
    const result = elaborateMatch(
      [
        { displayName: 'ID', jsonPath: PREFIXED_ID_PATH },
        { displayName: 'label', jsonPath: '$.lbl' },
        { displayName: 'synonym', jsonPath: '$.meta.synonyms[*].val' },
        { displayName: 'definition', jsonPath: '$.meta.definition.val' },
      ],
      testNode,
      new Set([0]),
      ['SO:0000001'],
      prefixes,
    )
    expect(result.length).toBe(1)
    expect(result).toMatchSnapshot()
  })
})
