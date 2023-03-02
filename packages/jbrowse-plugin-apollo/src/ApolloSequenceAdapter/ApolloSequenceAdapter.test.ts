import { beforeAll, beforeEach, describe, expect, it } from '@jest/globals'
import fetchMock from 'jest-fetch-mock'
import { toArray } from 'rxjs/operators'

import { ApolloSequenceAdapter, RefSeq } from './ApolloSequenceAdapter'
import configSchema from './configSchema'

const mockRefSeqs: RefSeq[] = [
  {
    _id: '6317dac51a89f156b2e21a70',
    name: 'ctgA',
    description: 'the first contig',
    length: 10000,
  },
  {
    _id: '6317dac51a89f156b2e21b7c',
    name: 'ctgB',
    description: 'the second contig',
    length: 10000,
  },
]

describe('ApolloSequenceAdapter', () => {
  let adapter: ApolloSequenceAdapter
  beforeAll(async () => {
    adapter = new ApolloSequenceAdapter(
      configSchema.create({
        assemblyId: '6317d5436061de774b43e9d6',
        baseURL: { uri: 'http://fake.url', locationType: 'UriLocation' },
      }),
    )
    // populate refSeqs cache before the tests are run
    fetchMock.mockResponseOnce(JSON.stringify(mockRefSeqs))
    await adapter.getRefNames({})
  })
  beforeEach(() => {
    fetchMock.resetMocks()
  })
  it('can get refNames and regions', async () => {
    const refNames = await adapter.getRefNames({})
    expect(refNames).toEqual(mockRefSeqs.map((r) => r.name))
    const regions = await adapter.getRegions({})
    expect(regions).toEqual(
      mockRefSeqs.map((r) => ({ refName: r.name, start: 0, end: r.length })),
    )
  })
  it('can get features', async () => {
    fetchMock.mockResponseOnce('GCGTGCAACAGACTTTCCATGATGCGAGCT')
    const features = adapter.getFeatures(
      { refName: 'ctgA', start: 0, end: 30 },
      {},
    )
    const featuresArray = await features.pipe(toArray()).toPromise()
    expect(featuresArray).toMatchInlineSnapshot(`
      [
        {
          "end": 30,
          "refName": "ctgA",
          "seq": "GCGTGCAACAGACTTTCCATGATGCGAGCT",
          "start": 0,
          "uniqueId": "ctgA 0-30",
        },
      ]
    `)
  })
})
