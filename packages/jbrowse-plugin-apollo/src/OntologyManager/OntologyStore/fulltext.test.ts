import { describe, expect, it } from '@jest/globals'

import { elaborateMatch, extractWords, getWords } from './fulltext'
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
    const result = getWords(testNode, [
      '$.lbl',
      '$.meta.definition.val',
      '$.meta.synonyms[*].val',
    ])
    expect([...result]).toMatchSnapshot()
  })
})

describe('elaborateMatch', () => {
  it('can do one', () => {
    const result = elaborateMatch(
      ['$.lbl', '$.meta.synonyms[*].val', '$.meta.definition.val'],
      testNode,
      new Set([1, 2]),
      ['zonk', 'nucleotide', 'region'],
    )
    expect(result.length).toBe(1)
    expect(result).toMatchSnapshot()
  })
})
