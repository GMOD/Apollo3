import { FeaturesController } from './features.controller.js'

describe('FeaturesController', () => {
  let controller: FeaturesController

  beforeEach(() => {
    controller = new FeaturesController({} as never)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
