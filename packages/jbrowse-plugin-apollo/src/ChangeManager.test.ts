import { Change, type SerializedChange } from '@apollo-annotation/common'
import { ClientValidation } from '@apollo-annotation/common/client'
import { ValidationResultSet } from '@apollo-annotation/shared'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

const notify = jest.fn()
const session = {
  notify,
  isLocked: false,
  changeInProgress: false,
  setChangeInProgress(inProgress: boolean) {
    session.changeInProgress = inProgress
  },
  showJobStatusWidget: jest.fn(),
  jobStatusWidget: { addJob: jest.fn(), updateJobStatus: jest.fn() },
}

jest.unstable_mockModule('@jbrowse/core/util', () => ({
  getSession: () => session,
}))

const { ChangeManager } = await import('./ChangeManager')
const { clientValidations } = await import('./validation/ClientValidationSet')
const { clientChangeTypes } = await import('./session/clientChangeTypes')

/** A change with no client handler whose inverse is the same type */
class TestChange extends Change {
  typeName: string
  constructor(json: SerializedChange) {
    super(json)
    this.typeName = json.typeName
  }
  toJSON() {
    return { typeName: this.typeName }
  }
  getInverse() {
    return new TestChange({ typeName: this.typeName })
  }
}

class TestPostValidation extends ClientValidation {
  name = 'TestPostValidation'
  postValidate(change: Change) {
    if (change.typeName === 'TestRejectedChange') {
      return 'not allowed'
    }
    return
  }
}
clientValidations.register(new TestPostValidation())

function makeChangeManager() {
  const submitChange = jest.fn(() => {
    const result = new ValidationResultSet()
    result.add({
      validationName: 'Backend',
      error: { message: 'backend says no' },
    })
    return Promise.resolve(result)
  })
  const dataStore = {
    collaborationServerDriver: { submitChange },
    getFeature: jest.fn(),
    getBackendDriver: () => null,
  }
  // @ts-expect-error minimal data store for testing
  return { changeManager: new ChangeManager(dataStore), submitChange }
}

describe('ChangeManager', () => {
  beforeEach(() => {
    notify.mockClear()
    session.changeInProgress = false
  })

  it('does not submit a change that fails frontend post-validation', async () => {
    const { changeManager, submitChange } = makeChangeManager()
    await changeManager.submit(
      new TestChange({ typeName: 'TestRejectedChange' }),
    )
    expect(submitChange).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(
      'Post-validation failed: "not allowed"',
      'error',
    )
    expect(session.changeInProgress).toBe(false)
    expect(changeManager.recentChanges).toHaveLength(0)
  })

  it('reports the backend validation message when the backend rejects', async () => {
    const { changeManager, submitChange } = makeChangeManager()
    await changeManager.submit(
      new TestChange({ typeName: 'TestBackendRejectedChange' }),
    )
    expect(submitChange).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith(
      'Post-validation failed: "backend says no"',
      'error',
    )
    expect(session.changeInProgress).toBe(false)
  })

  it('applies a change with its registered client handler', async () => {
    const handler = jest.fn<(change: Change, context: unknown) => void>()
    clientChangeTypes.register('TestHandledChange', {
      changeType: TestChange,
      handler,
    })
    const { changeManager } = makeChangeManager()
    const change = new TestChange({ typeName: 'TestHandledChange' })

    await changeManager.submit(change, { submitToBackend: false })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(
      change,
      expect.objectContaining({ dataStore: expect.anything() }),
    )
  })
})
