import { describe, expect, it, jest } from '@jest/globals'

import { revokeOtherApolloTokens } from './tokenUtils'

describe('ApolloInternetAccount token revocation', () => {
  it('revokes all other Apollo account tokens and keeps current token', () => {
    const keepCurrent = { tokenKey: 'token-current', removeToken: jest.fn() }
    const revokeFirst = { tokenKey: 'token-first', removeToken: jest.fn() }
    const revokeSecond = { tokenKey: 'token-second', removeToken: jest.fn() }

    revokeOtherApolloTokens(
      [keepCurrent, revokeFirst, revokeSecond],
      keepCurrent.tokenKey,
    )

    expect(keepCurrent.removeToken).not.toHaveBeenCalled()
    expect(revokeFirst.removeToken).toHaveBeenCalledTimes(1)
    expect(revokeSecond.removeToken).toHaveBeenCalledTimes(1)
  })
})
