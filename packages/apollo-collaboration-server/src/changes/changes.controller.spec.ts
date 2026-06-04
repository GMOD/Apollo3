import { ChangesController } from './changes.controller.js'

describe('ChangesController', () => {
  let controller: ChangesController
  beforeEach(() => {
    controller = new ChangesController({} as never)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
