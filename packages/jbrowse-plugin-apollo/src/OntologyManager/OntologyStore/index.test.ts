import { describe, expect, it, jest } from '@jest/globals'

import OntologyStore from '.'
import { OntologyTerm, isOntologyTerm } from '..'

jest.setTimeout(1000000000)
describe('OntologyStore', () => {
  it('can load goslim aspergillus', async () => {
    const o = new OntologyStore('GO-slim aspergillus', 'automated testing', {
      locationType: 'LocalPathLocation',
      localPath: `test_data/goslim_aspergillus.json`,
    })

    expect(await o.nodeCount()).toMatchSnapshot()
  })
  it('can load goslim generic', async () => {
    const o = new OntologyStore('Gene Ontology', 'automated testing', {
      locationType: 'LocalPathLocation',
      localPath: `test_data/goslim_generic.json`,
    })

    expect(await o.nodeCount()).toMatchSnapshot()
  })

  it('can load and query SO', async () => {
    const o = new OntologyStore('Sequence Ontology', 'automated testing', {
      locationType: 'LocalPathLocation',
      localPath: `test_data/so-v3.1.json`,
    })

    expect(await o.nodeCount()).toMatchSnapshot()

    const geneTerms = await o.getNodesWithLabelOrSynonym('gene')
    expect(geneTerms).toMatchSnapshot()
    expect(isOntologyTerm(geneTerms[0])).toBe(true)

    const geneParts = await o.getTermsThat(
      'part_of',
      geneTerms as OntologyTerm[],
    )
    expect(geneParts).toMatchSnapshot()
  })
})
