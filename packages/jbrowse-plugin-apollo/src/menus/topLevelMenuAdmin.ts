import type {
  AbstractMenuManager,
  AbstractSessionModel,
} from '@jbrowse/core/util'
import AddIcon from '@mui/icons-material/Add'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import DeleteIcon from '@mui/icons-material/Delete'
import InputIcon from '@mui/icons-material/Input'
import PersonIcon from '@mui/icons-material/Person'
import RuleIcon from '@mui/icons-material/Rule'

import {
  AddAssembly,
  AddAssemblyAliases,
  AddRefSeqAliases,
  DeleteAssembly,
  ImportFeatures,
  ManageChecks,
  ManageUsers,
} from '../components'
import type { ApolloSessionModel } from '../session'

export function addTopLevelAdminMenus(rootModel: AbstractMenuManager) {
  rootModel.appendToMenu('Apollo', {
    label: 'Admin',
    type: 'subMenu',
    icon: AdminPanelSettingsIcon,
    subMenu: [
      {
        label: 'Add Assembly',
        icon: AddIcon,
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
      },
      {
        label: 'Delete Assembly',
        icon: DeleteIcon,
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
      },
      {
        label: 'Import Features',
        icon: InputIcon,
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
      },
      {
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
      },
      {
        label: 'Add Assembly aliases',
        onClick: (session: ApolloSessionModel) => {
          ;(session as unknown as AbstractSessionModel).queueDialog(
            (doneCallback) => [
              AddAssemblyAliases,
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
      },
      {
        label: 'Manage Users',
        icon: PersonIcon,
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
      },
      {
        label: 'Manage Checks',
        icon: RuleIcon,
        onClick: (session: ApolloSessionModel) => {
          ;(session as unknown as AbstractSessionModel).queueDialog(
            (doneCallback) => [
              ManageChecks,
              {
                session,
                handleClose: () => {
                  doneCallback()
                },
              },
            ],
          )
        },
      },
    ],
  })
}
