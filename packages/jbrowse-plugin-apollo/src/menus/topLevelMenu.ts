import type {
  AbstractMenuManager,
  AbstractSessionModel,
} from '@jbrowse/core/util'
import { getDecodedToken } from '@apollo-annotation/shared'
import { isAlive } from '@jbrowse/mobx-state-tree'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import LogoutIcon from '@mui/icons-material/Logout'
import RedoIcon from '@mui/icons-material/Redo'
import UndoIcon from '@mui/icons-material/Undo'
import React from 'react'

import { LogOut, MyAssemblyPermissions } from '../components'
import type { ApolloSessionModel } from '../session'
import type { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import type { ApolloRootModel } from '../types'

function isUsableApolloAccount(
  account: unknown,
): account is ApolloInternetAccountModel {
  if (!account) {
    return false
  }
  const maybeAccount = account as {
    getToken?: unknown
    removeToken?: unknown
    internetAccountId?: unknown
  }
  return (
    typeof maybeAccount.getToken === 'function' &&
    typeof maybeAccount.removeToken === 'function' &&
    typeof maybeAccount.internetAccountId === 'string'
  )
}

function getApolloInternetAccounts(rootModel: ApolloRootModel) {
  const { internetAccounts } = rootModel
  return internetAccounts.filter((account) => {
    try {
      if (!isAlive(account)) {
        return false
      }
      return isUsableApolloAccount(account)
    } catch {
      return false
    }
  }) as ApolloInternetAccountModel[]
}

function getStoredToken(account?: ApolloInternetAccountModel) {
  if (!account) {
    return undefined
  }
  try {
    if (!isAlive(account)) {
      return undefined
    }
    const accountWithTokenKey = account as ApolloInternetAccountModel & {
      tokenKey?: string
    }
    if (!accountWithTokenKey.tokenKey) {
      return undefined
    }
    return globalThis.sessionStorage
      .getItem(accountWithTokenKey.tokenKey)
      ?.trim()
  } catch {
    return undefined
  }
}

function getSignedInApolloAccount(rootModel: ApolloRootModel) {
  return getApolloInternetAccounts(rootModel).find((account) =>
    Boolean(getStoredToken(account)),
  )
}

function getDefaultApolloAccount(rootModel: ApolloRootModel) {
  return getApolloInternetAccounts(rootModel).find(Boolean)
}

function isApolloSignedIn(rootModel: ApolloRootModel) {
  return Boolean(getStoredToken(getSignedInApolloAccount(rootModel)))
}

function getCurrentApolloUserLabel(rootModel: ApolloRootModel) {
  const signedInAccount = getSignedInApolloAccount(rootModel)
  const token = getStoredToken(signedInAccount)
  if (!token) {
    return 'Signed in as: not signed in'
  }
  try {
    const { username, email } = getDecodedToken(token)
    const identity = username || email || 'unknown user'
    return `Signed in as: ${identity}`
  } catch {
    return 'Signed in as: token unreadable'
  }
}

function ApolloUserMenuLabel({ rootModel }: { rootModel: ApolloRootModel }) {
  return getCurrentApolloUserLabel(rootModel)
}

function ApolloAuthMenuLabel({ rootModel }: { rootModel: ApolloRootModel }) {
  return isApolloSignedIn(rootModel) ? 'Log out' : 'Log in'
}

function notifyCurrentApolloUser(
  rootModel: ApolloRootModel,
  session: ApolloSessionModel,
) {
  const signedInAccount = getSignedInApolloAccount(rootModel)
  const sessionModel = session as unknown as AbstractSessionModel
  const token = getStoredToken(signedInAccount)
  if (!token) {
    sessionModel.notify('Apollo login status: not signed in', 'warning')
    return
  }
  try {
    const { username, email, role } = getDecodedToken(token)
    const identity = username || email || 'unknown user'
    const roleText = role ? ` (${role})` : ''
    sessionModel.notify(`Apollo login status: ${identity}${roleText}`, 'info')
  } catch {
    sessionModel.notify('Apollo login status: token unreadable', 'warning')
  }
}

export function addTopLevelMenus(rootModel: AbstractMenuManager) {
  rootModel.insertInMenu(
    'Apollo',
    {
      label: 'Redo',
      icon: RedoIcon,
      onClick(session: ApolloSessionModel) {
        const { apolloDataStore } = session
        void apolloDataStore.changeManager.redoLastChange()
      },
    },
    0,
  )
  rootModel.insertInMenu(
    'Apollo',
    {
      label: 'Undo',
      icon: UndoIcon,
      onClick(session: ApolloSessionModel) {
        const { apolloDataStore } = session
        void apolloDataStore.changeManager.undoLastChange()
      },
    },
    0,
  )

  rootModel.appendToMenu('Apollo', {
    label: 'Lock/Unlock session',
    onClick: (session: ApolloSessionModel) => {
      session.toggleLocked()
    },
  })
  const hasApolloInternetAccount =
    getApolloInternetAccounts(rootModel as unknown as ApolloRootModel).length >
    0
  if (hasApolloInternetAccount) {
    rootModel.insertInMenu(
      'Apollo',
      {
        label: React.createElement(ApolloUserMenuLabel, {
          rootModel: rootModel as unknown as ApolloRootModel,
        }),
        icon: AccountCircleIcon,
        onClick: (session: ApolloSessionModel) => {
          notifyCurrentApolloUser(
            rootModel as unknown as ApolloRootModel,
            session,
          )
        },
      },
      0,
    )

    rootModel.appendToMenu('Apollo', {
      label: 'My workspace',
      icon: FactCheckIcon,
      onClick: (session: ApolloSessionModel) => {
        ;(session as unknown as AbstractSessionModel).queueDialog(
          (doneCallback) => [
            MyAssemblyPermissions,
            {
              rootModel: rootModel as unknown as ApolloRootModel,
              handleClose: () => {
                doneCallback()
              },
            },
          ],
        )
      },
    })

    rootModel.appendToMenu('Apollo', {
      label: React.createElement(ApolloAuthMenuLabel, {
        rootModel: rootModel as unknown as ApolloRootModel,
      }),
      icon: LogoutIcon,
      onClick: (session: ApolloSessionModel) => {
        const apolloRootModel = rootModel as unknown as ApolloRootModel
        const sessionModel = session as unknown as AbstractSessionModel
        if (isApolloSignedIn(apolloRootModel)) {
          sessionModel.queueDialog((doneCallback) => [
            LogOut,
            {
              rootModel: apolloRootModel,
              handleClose: () => {
                doneCallback()
              },
            },
          ])
          return
        }

        const defaultAccount = getDefaultApolloAccount(apolloRootModel)
        if (!defaultAccount) {
          sessionModel.notify(
            'Apollo login is unavailable: no Apollo account configured',
            'error',
          )
          return
        }

        void defaultAccount
          .getToken()
          .then((token) => {
            try {
              const { username, email, role } = getDecodedToken(token)
              const identity = username || email || 'unknown user'
              const roleText = role ? ` (${role})` : ''
              sessionModel.notify(
                `Apollo login successful: ${identity}${roleText}`,
                'success',
              )
            } catch {
              sessionModel.notify('Apollo login successful', 'success')
            }
          })
          .catch((error: unknown) => {
            if (
              error instanceof Error &&
              /user cancelled entry/i.test(error.message)
            ) {
              return
            }
            const message =
              error instanceof Error ? error.message : 'Apollo login failed'
            sessionModel.notify(message, 'error')
          })
      },
    })
  }
}
