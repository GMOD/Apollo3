import {
  type AbstractMenuManager,
  type AbstractSessionModel,
} from '@jbrowse/core/util'
import DownloadIcon from '@mui/icons-material/Download'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import FileOpenIcon from '@mui/icons-material/FileOpen'
import LogoutIcon from '@mui/icons-material/Logout'
import RedoIcon from '@mui/icons-material/Redo'
import TrackChangesIcon from '@mui/icons-material/TrackChanges'
import UndoIcon from '@mui/icons-material/Undo'

import {
  DownloadGFF3,
  LogOut,
  OpenLocalFile,
  ViewChangeLog,
  ViewCheckResults,
} from '../components'
import { type ApolloSessionModel } from '../session'

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
    label: 'Download GFF3',
    icon: DownloadIcon,
    onClick: (session: ApolloSessionModel) => {
      ;(session as unknown as AbstractSessionModel).queueDialog(
        (doneCallback) => [
          DownloadGFF3,
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
    label: 'Open local GFF3 file',
    icon: FileOpenIcon,
    onClick: (session: ApolloSessionModel) => {
      ;(session as unknown as AbstractSessionModel).queueDialog(
        (doneCallback) => [
          OpenLocalFile,
          {
            session,
            handleClose: () => {
              doneCallback()
            },
            inMemoryFileDriver: session.apolloDataStore.inMemoryFileDriver,
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
