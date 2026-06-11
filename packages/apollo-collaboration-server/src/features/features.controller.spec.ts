import { FeaturesController } from './features.controller.js'
import { beforeEach, describe, expect, it } from '@jest/globals'

type FeaturesControllerCtorArgs = ConstructorParameters<
  typeof FeaturesController
>

describe('FeaturesController', () => {
  let controller: FeaturesController

  beforeEach(() => {
    controller = new FeaturesController({} as FeaturesControllerCtorArgs[0])
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
