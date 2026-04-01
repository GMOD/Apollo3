import type {
  AbstractMenuManager,
  AbstractSessionModel,
} from '@jbrowse/core/util'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import LogoutIcon from '@mui/icons-material/Logout'
import RedoIcon from '@mui/icons-material/Redo'
import TrackChangesIcon from '@mui/icons-material/TrackChanges'
import UndoIcon from '@mui/icons-material/Undo'

import { LogOut, ViewChangeLog, ViewCheckResults } from '../components'
import type { ApolloSessionModel } from '../session'
import { type ApolloRootModel, isApolloInternetAccount } from '../types'

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
    label: 'View Change Log',
    icon: TrackChangesIcon,
    onClick: (session: ApolloSessionModel) => {
      ;(session as unknown as AbstractSessionModel).queueDialog(
        (doneCallback) => [
          ViewChangeLog,
          {
            session,
            handleClose: () => {
              doneCallback()
            },
          },
        ],
      )
    },
  })
  rootModel.appendToMenu('Apollo', {
    label: 'View check results',
    icon: FactCheckIcon,
    onClick: (session: ApolloSessionModel) => {
      ;(session as unknown as AbstractSessionModel).queueDialog(
        (doneCallback) => [
          ViewCheckResults,
          {
            session,
            handleClose: () => {
              doneCallback()
            },
          },
        ],
      )
    },
  })
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
    rootModel.appendToMenu('Apollo', {
      label: 'Log out',
      icon: LogoutIcon,
      onClick: (session: ApolloSessionModel) => {
        ;(session as unknown as AbstractSessionModel).queueDialog(
          (doneCallback) => [
            LogOut,
            {
              session,
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
