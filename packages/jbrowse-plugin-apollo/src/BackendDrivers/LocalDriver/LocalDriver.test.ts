import { describe, expect, it, jest } from '@jest/globals'

import type { ClientDataStoreModel } from '../../session/ClientDataStore'

import { LocalDriver } from './LocalDriver'
import { openDb } from './db'

describe('LocalDriver', () => {
  it('summarizes feature density from IndexedDB', async () => {
    const assemblyName = 'densityTestAssembly'
    const driver = new LocalDriver({} as ClientDataStoreModel)
    jest
      .spyOn(driver, 'getRegions')
      .mockResolvedValue([
        { assemblyName, refName: 'ctgA', start: 0, end: 10_000 },
      ])
    const db = await openDb(assemblyName, ['ctgA'])
    const features = [
      { _id: 'long', min: 0, max: 10_000, strand: 1 },
      { _id: 'short', min: 250, max: 260, strand: -1 },
      { _id: 'outside', min: 2000, max: 3000 },
    ]
    for (const feature of features) {
      await db.put('features-ctgA', feature, feature._id)
    }
    db.close()

    const density = await driver.getFeatureDensity(
      { assemblyName, refName: 'ctgA', start: 0, end: 1000 },
      100,
    )
    expect(density).toEqual({
      count: 2,
      start: 0,
      binSize: 100,
      bins: [1, 1, 2, 1, 1, 1, 1, 1, 1, 1],
      strandBins: {
        forward: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        reverse: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        unstranded: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    })
  })
})
