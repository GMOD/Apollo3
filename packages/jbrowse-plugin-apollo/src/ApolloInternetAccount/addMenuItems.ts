import {
  type AbstractMenuManager,
  type AbstractSessionModel,
} from '@jbrowse/core/util'

import {
  AddAssembly,
  AddRefSeqAliases,
  DeleteAssembly,
  ImportFeatures,
  ManageUsers,
} from '../components'
import { type ApolloSessionModel } from '../session'

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
    label: 'Add reference sequence aliases',
    onClick: (session: ApolloSessionModel) => {
      ;(session as unknown as AbstractSessionModel).queueDialog(
        (doneCallback) => [
          AddRefSeqAliases,
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
}
