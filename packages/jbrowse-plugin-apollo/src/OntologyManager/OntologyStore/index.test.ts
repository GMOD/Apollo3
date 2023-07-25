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
    const topLevelClasses = await so.getTermsWithoutPropertyLabeled('part_of')
    expect(topLevelClasses.length).toMatchSnapshot()
    expect(topLevelClasses.find((term) => term.lbl === 'mRNA')).toBeUndefined()
  })
})
