import type {
  AbstractMenuManager,
  AbstractSessionModel,
} from '@jbrowse/core/util'
import LogoutIcon from '@mui/icons-material/Logout'
import RedoIcon from '@mui/icons-material/Redo'
import UndoIcon from '@mui/icons-material/Undo'

import { LogOut } from '../components'
import type { ApolloSessionModel } from '../session'

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
