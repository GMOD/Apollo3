import type {
  AbstractMenuManager,
  AbstractSessionModel,
  SessionWithWidgets,
} from '@jbrowse/core/util'
import HelpIcon from '@mui/icons-material/Help'
import LogoutIcon from '@mui/icons-material/Logout'
import RedoIcon from '@mui/icons-material/Redo'
import UndoIcon from '@mui/icons-material/Undo'

import { LogOut } from '../components'
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
    label: 'Lock/Unlock session',
    onClick: (session: ApolloSessionModel) => {
      session.toggleLocked()
    },
  })
  rootModel.appendToMenu('Apollo', {
    label: 'Help',
    icon: HelpIcon,
    onClick: (session: SessionWithWidgets) => {
      const widget = session.addWidget('ApolloHelpWidget', 'apolloHelpWidget')
      session.showWidget(widget)
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
