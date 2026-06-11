import { FeaturesService } from './features.service.js'

type FeaturesServiceCtorArgs = ConstructorParameters<typeof FeaturesService>

describe('FeaturesService', () => {
  let service: FeaturesService

  beforeEach(() => {
    service = new FeaturesService(
      {} as FeaturesServiceCtorArgs[0],
      {} as FeaturesServiceCtorArgs[1],
      {} as FeaturesServiceCtorArgs[2],
      {} as FeaturesServiceCtorArgs[3],
    )
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
