import { getDecodedToken } from '@apollo-annotation/shared'
import type {
  AbstractMenuManager,
  AbstractSessionModel,
} from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import LogoutIcon from '@mui/icons-material/Logout'
import RedoIcon from '@mui/icons-material/Redo'
import UndoIcon from '@mui/icons-material/Undo'
import React from 'react'

import type { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { LogOut, MyAssemblyPermissions } from '../components'
import type { ApolloSessionModel } from '../session'
import { type ApolloRootModel, isApolloInternetAccount } from '../types'

function getApolloInternetAccounts(rootModel: ApolloRootModel) {
  const { internetAccounts } = rootModel
  return internetAccounts.filter((account) => {
    try {
      if (!isAlive(account)) {
        return false
      }
      return isApolloInternetAccount(account)
    } catch {
      return false
    }
  }) as ApolloInternetAccountModel[]
}

function getStoredToken(account?: ApolloInternetAccountModel) {
  if (!account) {
    return
  }
  try {
    if (!isAlive(account)) {
      return
    }
    const accountWithTokenKey = account as ApolloInternetAccountModel & {
      tokenKey?: string
    }
    if (!accountWithTokenKey.tokenKey) {
      return
    }
    const token = globalThis.sessionStorage.getItem(
      accountWithTokenKey.tokenKey,
    )
    return token ? token.trim() : undefined
  } catch {
    return
  }
}

function isGuestToken(token: string) {
  try {
    const { username, email } = getDecodedToken(token)
    const normalizedUsername = String(username).toLowerCase()
    const normalizedEmail = String(email).toLowerCase()
    return normalizedUsername === 'guest' || normalizedEmail === 'guest_user'
  } catch {
    return false
  }
}

function getSignedInApolloAccount(rootModel: ApolloRootModel) {
  const signedInAccounts = getApolloInternetAccounts(rootModel).filter(
    (account) => Boolean(getStoredToken(account)),
  )
  const nonGuestSignedInAccount = signedInAccounts.find((account) => {
    const token = getStoredToken(account)
    return token ? !isGuestToken(token) : false
  })
  return nonGuestSignedInAccount ?? signedInAccounts[0]
}

function getDefaultApolloAccount(rootModel: ApolloRootModel) {
  return getApolloInternetAccounts(rootModel).find(Boolean)
}

function promptApolloLogin(account: ApolloInternetAccountModel) {
  const maybePromptableAccount = account as ApolloInternetAccountModel & {
    loginWithPrompt?: () => Promise<string>
  }
  if (typeof maybePromptableAccount.loginWithPrompt === 'function') {
    return maybePromptableAccount.loginWithPrompt()
  }
  return account.getToken()
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
      label: 'Log in',
      icon: AccountCircleIcon,
      onClick: (session: ApolloSessionModel) => {
        const apolloRootModel = rootModel as unknown as ApolloRootModel
        const sessionModel = session as unknown as AbstractSessionModel
        const defaultAccount = getDefaultApolloAccount(apolloRootModel)
        if (!defaultAccount) {
          sessionModel.notify(
            'Apollo login is unavailable: no Apollo account configured',
            'error',
          )
          return
        }

        void promptApolloLogin(defaultAccount)
          .then((token) => {
            try {
              const { username, email, role } = getDecodedToken(token)
              const identity = username || email || 'unknown user'
              const roleText = role ? ` (${role})` : ''
              sessionModel.notify(
                `Apollo login successful: ${identity}${roleText}`,
                'success',
              )
              // Rebuild session/view track selector state after auth changes.
              // This avoids stale "Available tracks" panels after guest <-> user.
              globalThis.location.reload()
              return
            } catch {
              sessionModel.notify('Apollo login successful', 'success')
              globalThis.location.reload()
              return
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

    rootModel.appendToMenu('Apollo', {
      label: 'Log out',
      icon: LogoutIcon,
      onClick: (session: ApolloSessionModel) => {
        const apolloRootModel = rootModel as unknown as ApolloRootModel
        const sessionModel = session as unknown as AbstractSessionModel
        if (!isApolloSignedIn(apolloRootModel)) {
          sessionModel.notify('Apollo is already signed out', 'info')
          return
        }

        sessionModel.queueDialog((doneCallback) => [
          LogOut,
          {
            rootModel: apolloRootModel,
            handleClose: () => {
              doneCallback()
            },
          },
        ])
      },
    })
  }
}
