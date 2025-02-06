import { OntologyRecord, OntologyRecordType } from '.'
import { beforeAll, describe, expect, it } from '@jest/globals'

const ontologies = {
  name: 'Sequence Ontology',
  version: 'unversioned',
  source: {
    locationType: 'LocalPathLocation' as const,
    uri: 'test_data/so-v3.1.json',
    localPath: require.resolve('../../test_data/so-v3.1.json'),
  },
  options: {
    textIndexing: {
      indexFields: [
        {
          displayName: 'Label',
          jsonPath: '$.lbl',
        },
        {
          displayName: 'Synonym',
          jsonPath: '$.meta.synonyms[*].val',
        },
        {
          displayName: 'Definition',
          jsonPath: '$.meta.definition.val',
        },
      ],
    },
  },
}

let ontologyRecord: OntologyRecord
beforeAll(async () => {
  ontologyRecord = OntologyRecordType.create(ontologies)
  // We need to first retrieve the equivalent types
  await ontologyRecord.loadEquivalentTypes('gene')
}, 60_000)

describe('isTypeOf', () => {
  it('Check child is type of parent', () => {
    const out = ontologyRecord.isTypeOf('protein_coding_gene', 'gene')
    expect(out).toBeTruthy()
  })

  it('Check child of child', () => {
    const out = ontologyRecord.isTypeOf('gene_with_edited_transcript', 'gene')
    expect(out).toBeTruthy()
  })

  it('Check equal to itself', () => {
    const out = ontologyRecord.isTypeOf('gene', 'gene')
    expect(out).toBeTruthy()
  })

  it('Parent is not a type of child', () => {
    let out = ontologyRecord.isTypeOf('gene', 'protein_coding_gene')
    expect(out).toBeFalsy()

    out = ontologyRecord.isTypeOf('protein_coding_gene', 'CDS')
    expect(out).toBeFalsy()
  })
})
