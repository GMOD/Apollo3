/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { beforeEach, describe, expect, it } from '@jest/globals'

import { FeaturesController } from './features.controller.js'

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
