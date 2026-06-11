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
