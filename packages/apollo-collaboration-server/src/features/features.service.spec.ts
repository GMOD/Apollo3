import { FeaturesService } from './features.service.js'

describe('FeaturesService', () => {
  let service: FeaturesService

  beforeEach(() => {
    service = new FeaturesService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    )
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
