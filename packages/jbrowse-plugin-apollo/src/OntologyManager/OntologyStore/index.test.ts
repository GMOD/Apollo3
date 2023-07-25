import { describe, expect, it, jest } from '@jest/globals'

import OntologyStore from '.'
import { OntologyClass, isOntologyClass } from '..'

jest.setTimeout(1000000000)
const so = new OntologyStore('Sequence Ontology', 'automated testing', {
  locationType: 'LocalPathLocation',
  localPath: `test_data/so-v3.1.json`,
})

describe('OntologyStore', () => {
  it('can load goslim aspergillus', async () => {
    const goslimAspergillus = new OntologyStore(
      'GO-slim aspergillus',
      'automated testing',
      {
        locationType: 'LocalPathLocation',
        localPath: `test_data/goslim_aspergillus.json`,
      },
    )

    expect(await goslimAspergillus.nodeCount()).toMatchSnapshot()
  })
  it('can load goslim generic', async () => {
    const goslimGeneric = new OntologyStore(
      'Gene Ontology',
      'automated testing',
      {
        locationType: 'LocalPathLocation',
        localPath: `test_data/goslim_generic.json`,
      },
    )

    expect(await goslimGeneric.nodeCount()).toMatchSnapshot()
  })

  it('can query SO', async () => {
    expect(await so.nodeCount()).toMatchSnapshot()
  })
  it('can query SO gene terms and parts of genes', async () => {
    const geneTerms = await so.getNodesWithLabelOrSynonym('gene')
    expect(geneTerms).toMatchSnapshot()
    expect(isOntologyClass(geneTerms[0])).toBe(true)
    const geneParts = await so.getTermsThat(
      'part_of',
      geneTerms as OntologyClass[],
    )
    expect(geneParts).toMatchSnapshot()
  })
  it('can query SO features not part of something else', async () => {
    const topLevelClasses = await so.getTermsWithoutPropertyLabeled('part_of', {
      includeSubProperties: true,
    })
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
    expect(ex).toMatchInlineSnapshot(`
      [
        "http://purl.obolibrary.org/obo/SO_0000039",
      ]
    `)
  })
  it('can query valid part_of for match', async () => {
    const parentTypeTerms = (
      await so.getNodesWithLabelOrSynonym('match', {
        includeSubclasses: false,
      })
    ).filter(isOntologyClass)
    expect(parentTypeTerms).toMatchInlineSnapshot(`
      [
        {
          "id": "http://purl.obolibrary.org/obo/SO_0000343",
          "lbl": "match",
          "meta": {
            "basicPropertyValues": [
              {
                "pred": "http://www.geneontology.org/formats/oboInOwl#hasOBONamespace",
                "val": "sequence",
              },
            ],
            "definition": {
              "val": "A region of sequence, aligned to another sequence with some statistical significance, using an algorithm such as BLAST or SIM4.",
              "xrefs": [
                "SO:ke",
              ],
            },
            "subsets": [
              "http://purl.obolibrary.org/obo/so#SOFA",
            ],
          },
          "type": "CLASS",
        },
      ]
    `)
    const subpartTerms = await so.getTermsThat('part_of', parentTypeTerms)
    expect(subpartTerms.length).toBeGreaterThan(0)
  })
})
