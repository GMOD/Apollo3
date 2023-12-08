import PluginManager from '@jbrowse/core/PluginManager'
import { MenuItem } from '@jbrowse/core/ui'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'

import {
  AddAssembly,
  DeleteAssembly,
  ImportFeatures,
  ManageUsers,
} from '../components'
import { ApolloSessionModel } from '../session'

interface Menu {
  label: string
  menuItems: MenuItem[]
}

export type Role = 'admin' | 'user' | 'readOnly'

export function addMenuItems(pluginManager: PluginManager, role: Role) {
  if (!(role === 'admin' && isAbstractMenuManager(pluginManager.rootModel))) {
    return
  }
  const { rootModel } = pluginManager
  const { menus } = rootModel as unknown as { menus: Menu[] }
  // Find 'Apollo' menu and its items
  const apolloMenu = menus.find((menu) => {
    return menu.label === 'Apollo'
  })
  if (!apolloMenu) {
    return
  }
  const { menuItems } = apolloMenu
  if (
    !menuItems.some(
      (menuItem) => 'label' in menuItem && menuItem.label === 'Add Assembly',
    )
  ) {
    rootModel.insertInMenu(
      'Apollo',
      {
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
      },
      0,
    )
    rootModel.insertInMenu(
      'Apollo',
      {
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
      },
      1,
    )
    rootModel.insertInMenu(
      'Apollo',
      {
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
                changeManager: (session as ApolloSessionModel).apolloDataStore
                  .changeManager,
              },
            ],
          )
        },
      },
      2,
    )
    rootModel.insertInMenu(
      'Apollo',
      {
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
                changeManager: (session as ApolloSessionModel).apolloDataStore
                  .changeManager,
              },
            ],
          )
        },
      },
      9,
    )
    rootModel.insertInMenu(
      'Apollo',
      {
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
      },
      10,
    )
  }
}
