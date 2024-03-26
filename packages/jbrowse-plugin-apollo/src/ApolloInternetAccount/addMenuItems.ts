import { AbstractMenuManager, AbstractSessionModel } from '@jbrowse/core/util'

import {
  AddAssembly,
  DeleteAssembly,
  ImportFeatures,
  ManageUsers,
  SaveTrack,
} from '../components'
import { ApolloSessionModel } from '../session'

export function addMenuItems(rootModel: AbstractMenuManager) {
  rootModel.appendToMenu('Apollo', {
    label: 'Add Assembly',
    onClick: (session: ApolloSessionModel) => {
      ;(session as unknown as AbstractSessionModel).queueDialog(
        (doneCallback) => [
          AddAssembly,
          {
            session,
            handleClose: () => {
              doneCallback()
            },
            changeManager: session.apolloDataStore.changeManager,
          },
        ],
      )
    },
  })
  rootModel.appendToMenu('Apollo', {
    label: 'Delete Assembly',
    onClick: (session: ApolloSessionModel) => {
      ;(session as unknown as AbstractSessionModel).queueDialog(
        (doneCallback) => [
          DeleteAssembly,
          {
            session,
            handleClose: () => {
              doneCallback()
            },
            changeManager: session.apolloDataStore.changeManager,
          },
        ],
      )
    },
  })
  rootModel.appendToMenu('Apollo', {
    label: 'Import Features',
    onClick: (session: ApolloSessionModel) => {
      ;(session as unknown as AbstractSessionModel).queueDialog(
        (doneCallback) => [
          ImportFeatures,
          {
            session,
            handleClose: () => {
              doneCallback()
            },
            changeManager: session.apolloDataStore.changeManager,
          },
        ],
      )
    },
  })
  rootModel.appendToMenu('Apollo', {
    label: 'Manage Users',
    onClick: (session: ApolloSessionModel) => {
      ;(session as unknown as AbstractSessionModel).queueDialog(
        (doneCallback) => [
          ManageUsers,
          {
            session,
            handleClose: () => {
              doneCallback()
            },
            changeManager: session.apolloDataStore.changeManager,
          },
        ],
      )
    },
  })
  rootModel.appendToMenu('Apollo', {
    label: 'Undo',
    onClick: (session: ApolloSessionModel) => {
      const { apolloDataStore } = session
      const { notify } = session as unknown as AbstractSessionModel
      if (apolloDataStore.changeManager.recentChanges.length > 0) {
        void apolloDataStore.changeManager.revertLastChange()
      } else {
        notify('No changes to undo', 'info')
      }
    },
  })
  rootModel.appendToMenu('Apollo', {
    label: 'Save Track Configuration',
    onClick: (session: ApolloSessionModel) => {
      ;(session as unknown as AbstractSessionModel).queueDialog(
        (doneCallback) => [
          SaveTrack,
          {
            session,
            handleClose: () => {
              doneCallback()
            },
            changeManager: session.apolloDataStore.changeManager,
          },
        ],
      )
    },
  })
}
