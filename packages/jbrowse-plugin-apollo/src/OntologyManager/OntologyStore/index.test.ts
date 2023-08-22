import { beforeAll, describe, expect, it, jest } from '@jest/globals'

import OntologyStore from '.'
import { OntologyClass, isOntologyClass } from '..'

jest.setTimeout(1_000_000_000)

const prefixes = new Map([
  ['SO:', 'http://purl.obolibrary.org/obo/SO_'],
  ['GO:', 'http://purl.obolibrary.org/obo/GO_'],
])

let so: OntologyStore

beforeAll(async () => {
  so = new OntologyStore(
    'Sequence Ontology',
    'automated testing',
    { locationType: 'LocalPathLocation', localPath: 'test_data/so-v3.1.json' },
    { prefixes },
  )
  await so.db
})

describe('OntologyStore', () => {
  it('can load goslim generic', async () => {
    const goslimGeneric = new OntologyStore(
      'Gene Ontology',
      'automated testing',
      {
        locationType: 'LocalPathLocation',
        localPath: 'test_data/goslim_generic.json',
      },
      { prefixes },
    )

    expect(await goslimGeneric.termCount()).toMatchSnapshot()

    expect(
      await goslimGeneric.getTermsByFulltext('mitotic nuclear division'),
    ).toMatchSnapshot()
  })

  it('can query SO', async () => {
    expect(await so.termCount()).toMatchSnapshot()
  })
  it('can query SO gene terms and parts of genes', async () => {
    const geneTerms = await so.getTermsWithLabelOrSynonym('gene')
    expect(geneTerms).toMatchSnapshot()
    expect(isOntologyClass(geneTerms[0])).toBe(true)
    const geneParts = await so.getClassesThat(
      'part_of',
      geneTerms as OntologyClass[],
    )
    expect(geneParts).toMatchSnapshot()
  })
  it('can query SO features not part of something else', async () => {
    const topLevelClasses = await so.getClassesWithoutPropertyLabeled(
      'part_of',
      { includeSubProperties: true },
    )
    expect(topLevelClasses.length).toMatchSnapshot()
    expect(topLevelClasses.find((term) => term.lbl === 'mRNA')).toBeUndefined()
    // gene is member_of gene_group, so also doesn't appear here. There doesn't seem to be
    // clarification in SO for when a feature MUST be part_of.
    expect(topLevelClasses.find((term) => term.lbl === 'gene')).toBeUndefined()
  })
  it('can expand subclasses of SO:000039 and still get SO:000039', async () => {
    const expanded = so.expandSubclasses(
      ['http://purl.obolibrary.org/obo/SO_0000039'],
      'is_a',
    )

    const ex = []
    for await (const node of expanded) {
      ex.push(node)
    }
    expect(ex.length).toBeGreaterThan(0)
    expect(ex).toEqual(['http://purl.obolibrary.org/obo/SO_0000039'])
  })
  it('can query valid part_of for match', async () => {
    const parentTypeTerms = await so.getTermsWithLabelOrSynonym('match', {
      includeSubclasses: false,
    })
    // eslint-disable-next-line unicorn/no-array-callback-reference
    const parentTypeClassTerms = parentTypeTerms.filter(isOntologyClass)
    expect(parentTypeClassTerms).toMatchSnapshot()
    const subpartTerms = await so.getClassesThat(
      'part_of',
      parentTypeClassTerms,
    )
    expect(subpartTerms.length).toBeGreaterThan(0)
  })

  it('SO clone_insert_end is among valid subparts of BAC_cloned_genomic_insert', async () => {
    const bcgi = await so.getTermsWithLabelOrSynonym(
      'BAC_cloned_genomic_insert',
      { includeSubclasses: false },
    )
    // eslint-disable-next-line unicorn/no-array-callback-reference
    const bcgiClas = bcgi.filter(isOntologyClass)
    expect(bcgiClas.length).toBe(1)
    expect(bcgiClas[0].lbl).toBe('BAC_cloned_genomic_insert')
    const subpartTerms = await so.getClassesThat('part_of', bcgiClas)
    expect(subpartTerms.length).toBeGreaterThan(0)
    expect(subpartTerms.find((t) => t.lbl === 'clone_insert_end')).toBeTruthy()
    expect(subpartTerms).toMatchSnapshot()
  })
})
