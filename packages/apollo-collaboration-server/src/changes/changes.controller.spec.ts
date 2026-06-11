/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { beforeEach, describe, expect, it } from '@jest/globals'

import { ChangesController } from './changes.controller.js'

type ChangesControllerCtorArgs = ConstructorParameters<typeof ChangesController>

describe('ChangesController', () => {
  let controller: ChangesController
  beforeEach(() => {
    controller = new ChangesController({} as ChangesControllerCtorArgs[0])
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
