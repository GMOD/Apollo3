import type {
  AbstractMenuManager,
  AbstractSessionModel,
} from '@jbrowse/core/util'
import { getDecodedToken } from '@apollo-annotation/shared'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import LogoutIcon from '@mui/icons-material/Logout'
import RedoIcon from '@mui/icons-material/Redo'
import UndoIcon from '@mui/icons-material/Undo'
import React from 'react'

import { LogOut, MyAssemblyPermissions } from '../components'
import type { ApolloSessionModel } from '../session'
import type { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { type ApolloRootModel, isApolloInternetAccount } from '../types'

function getSignedInApolloAccount(rootModel: ApolloRootModel) {
  const { internetAccounts } = rootModel
  return internetAccounts
    .filter(isApolloInternetAccount)
    .find((ia) => Boolean(ia.retrieveToken())) as
    | ApolloInternetAccountModel
    | undefined
}

function getCurrentApolloUserLabel(rootModel: ApolloRootModel) {
  const signedInAccount = getSignedInApolloAccount(rootModel)
  if (!signedInAccount) {
    return 'Signed in as: not signed in'
  }
  const token = signedInAccount.retrieveToken()
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
  if (!signedInAccount) {
    sessionModel.notify('Apollo login status: not signed in', 'warning')
    return
  }
  const token = signedInAccount.retrieveToken()
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
  const { internetAccounts } = rootModel as unknown as ApolloRootModel
  const hasApolloInternetAccount = internetAccounts.some((ia) =>
    isApolloInternetAccount(ia),
  )
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
      label: 'Log out',
      icon: LogoutIcon,
      onClick: (session: ApolloSessionModel) => {
        ;(session as unknown as AbstractSessionModel).queueDialog(
          (doneCallback) => [
            LogOut,
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
  }
}
