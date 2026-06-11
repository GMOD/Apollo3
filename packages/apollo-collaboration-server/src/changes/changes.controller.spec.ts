import { ChangesController } from './changes.controller.js'
import { beforeEach, describe, expect, it } from '@jest/globals'

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
