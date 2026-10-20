import { changeRegistry } from '@apollo-annotation/common'
import type { CheckResultSnapshot } from '@apollo-annotation/mst'
import {
  type ChangeMessage,
  LocationEndChange,
} from '@apollo-annotation/shared'
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'

import {
  type EventSourceHandlerContext,
  handleCommonMessage,
  handleRequestInformationMessage,
  handleUserLocationMessage,
} from './eventSourceHandlers'

const localSessionId = 'me-1000'
const otherSessionId = 'someoneElse-2000'

const checkResult = {
  _id: 'check1',
  name: 'CDSCheck',
  ids: ['feature1'],
  refSeq: 'ctgA',
  start: 1,
  end: 10,
  message: 'Problem',
} as unknown as CheckResultSnapshot

const changeMessage: ChangeMessage = {
  channel: 'COMMON',
  userName: 'Someone Else',
  userSessionId: otherSessionId,
  changeSequence: 12,
  changeInfo: {
    typeName: 'LocationEndChange',
    assembly: 'asm1',
    changedIds: ['feature1'],
    featureId: 'feature1',
    oldEnd: 100,
    newEnd: 110,
  } as ChangeMessage['changeInfo'],
}

function makeContext() {
  return {
    localSessionId,
    addCheckResult: jest.fn(),
    deleteCheckResult: jest.fn(),
    applyRemoteChange: jest.fn(),
    addOrUpdateCollaborator: jest.fn(),
    broadcastLocations: jest.fn(),
  } satisfies EventSourceHandlerContext
}

describe('server-sent event handlers', () => {
  let context: ReturnType<typeof makeContext>

  beforeAll(() => {
    try {
      changeRegistry.registerChange('LocationEndChange', LocationEndChange)
    } catch {
      // already registered
    }
    // Node doesn't provide sessionStorage without a flag
    if (typeof sessionStorage === 'undefined') {
      const store = new Map<string, string>()
      Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        value: {
          getItem: (key: string) => store.get(key) ?? null,
          setItem: (key: string, value: string) => store.set(key, value),
          removeItem: (key: string) => store.delete(key),
          clear: () => {
            store.clear()
          },
        },
      })
    }
  })

  beforeEach(() => {
    context = makeContext()
    sessionStorage.clear()
  })

  describe('COMMON', () => {
    it('adds a check result', () => {
      handleCommonMessage(
        {
          channel: 'COMMON',
          userName: 'none',
          userSessionId: 'none',
          checkResult,
        },
        context,
      )
      expect(context.addCheckResult).toHaveBeenCalledWith(checkResult)
      expect(context.deleteCheckResult).not.toHaveBeenCalled()
      expect(context.applyRemoteChange).not.toHaveBeenCalled()
    })

    it('deletes a check result', () => {
      handleCommonMessage(
        {
          channel: 'COMMON',
          userName: 'none',
          userSessionId: 'none',
          checkResult,
          deleted: true,
        },
        context,
      )
      expect(context.deleteCheckResult).toHaveBeenCalledWith('check1')
      expect(context.addCheckResult).not.toHaveBeenCalled()
    })

    it('applies a change from another session', () => {
      handleCommonMessage(changeMessage, context)
      expect(sessionStorage.getItem('LastChangeSequence')).toBe('12')
      expect(context.applyRemoteChange).toHaveBeenCalledTimes(1)
      const [change] = context.applyRemoteChange.mock.calls[0] as [
        LocationEndChange,
      ]
      expect(change).toBeInstanceOf(LocationEndChange)
      expect(change.toJSON()).toEqual(changeMessage.changeInfo)
    })

    it('records but does not reapply a change from this session', () => {
      handleCommonMessage(
        { ...changeMessage, userSessionId: localSessionId, changeSequence: 13 },
        context,
      )
      expect(sessionStorage.getItem('LastChangeSequence')).toBe('13')
      expect(context.applyRemoteChange).not.toHaveBeenCalled()
    })
  })

  describe('USER_LOCATION', () => {
    const locations = [{ assemblyId: 'asm1', refSeq: 'ctgA', start: 1, end: 9 }]

    it("adds another session's location as a collaborator", () => {
      handleUserLocationMessage(
        {
          channel: 'USER_LOCATION',
          userName: 'Someone Else',
          userSessionId: otherSessionId,
          locations,
        },
        context,
      )
      expect(context.addOrUpdateCollaborator).toHaveBeenCalledWith({
        name: 'Someone Else',
        id: otherSessionId,
        locations,
      })
    })

    it("ignores this session's own location", () => {
      handleUserLocationMessage(
        {
          channel: 'USER_LOCATION',
          userName: 'Me',
          userSessionId: localSessionId,
          locations,
        },
        context,
      )
      expect(context.addOrUpdateCollaborator).not.toHaveBeenCalled()
    })
  })

  describe('REQUEST_INFORMATION', () => {
    it("broadcasts this session's locations when asked", () => {
      handleRequestInformationMessage(
        {
          channel: 'REQUEST_INFORMATION',
          userName: 'Someone Else',
          userSessionId: otherSessionId,
          reqType: 'CURRENT_LOCATION',
        },
        context,
      )
      expect(context.broadcastLocations).toHaveBeenCalledTimes(1)
    })

    it('does not answer its own request', () => {
      handleRequestInformationMessage(
        {
          channel: 'REQUEST_INFORMATION',
          userName: 'Me',
          userSessionId: localSessionId,
          reqType: 'CURRENT_LOCATION',
        },
        context,
      )
      expect(context.broadcastLocations).not.toHaveBeenCalled()
    })
  })
})
