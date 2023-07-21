import { describe, expect, it, jest } from '@jest/globals'

import OntologyStore from '.'

jest.setTimeout(1000000000)
describe('OntologyStore', () => {
  it('can load goslim aspergillus', async () => {
    const o = new OntologyStore('GO-slim aspergillus', 'automated testing', {
      locationType: 'LocalPathLocation',
      localPath: `test_data/goslim_aspergillus.json`,
    })

    expect(await o.nodeCount()).toBeGreaterThan(0)
  })
  it('can load goslim generic', async () => {
    const o = new OntologyStore('Gene Ontology', 'automated testing', {
      locationType: 'LocalPathLocation',
      localPath: `test_data/goslim_generic.json`,
    })

    expect(await o.nodeCount()).toBeGreaterThan(0)
  })
})
