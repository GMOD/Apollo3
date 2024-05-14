import { MenuItem } from '@jbrowse/core/ui'
import { AbstractSessionModel } from '@jbrowse/core/util'
import { AnnotationFeatureNew } from 'apollo-mst'

import { ChangeManager } from '../../ChangeManager'
import {
  AddChildFeature,
  CopyFeature,
  DeleteFeature,
  ModifyFeatureAttribute,
} from '../../components'
import { ApolloSessionModel } from '../../session'
import { getApolloInternetAccount } from '../../util'

export function featureContextMenuItems(
  feature: AnnotationFeatureNew | undefined,
  region: { assemblyName: string; refName: string; start: number; end: number },
  getAssemblyId: (assemblyName: string) => string,
  selectedFeature: AnnotationFeatureNew | undefined,
  setSelectedFeature: (f: AnnotationFeatureNew | undefined) => void,
  session: ApolloSessionModel,
  changeManager: ChangeManager,
) {
  const internetAccount = getApolloInternetAccount(session)
  const role = internetAccount ? internetAccount.role : 'admin'
  const admin = role === 'admin'
  const readOnly = !(role && ['admin', 'user'].includes(role))
  const menuItems: MenuItem[] = []
  if (feature) {
    const sourceAssemblyId = getAssemblyId(region.assemblyName)
    const currentAssemblyId = getAssemblyId(region.assemblyName)
    menuItems.push(
      {
        label: 'Add child feature',
        disabled: readOnly,
        onClick: () => {
          ;(session as unknown as AbstractSessionModel).queueDialog(
            (doneCallback) => [
              AddChildFeature,
              {
                session,
                handleClose: () => {
                  doneCallback()
                },
                changeManager,
                sourceFeature: feature,
                sourceAssemblyId,
                internetAccount,
              },
            ],
          )
        },
      },
      {
        label: 'Copy features and annotations',
        disabled: readOnly,
        onClick: () => {
          ;(session as unknown as AbstractSessionModel).queueDialog(
            (doneCallback) => [
              CopyFeature,
              {
                session,
                handleClose: () => {
                  doneCallback()
                },
                changeManager,
                sourceFeature: feature,
                sourceAssemblyId: currentAssemblyId,
              },
            ],
          )
        },
      },
      {
        label: 'Delete feature',
        disabled: !admin,
        onClick: () => {
          ;(session as unknown as AbstractSessionModel).queueDialog(
            (doneCallback) => [
              DeleteFeature,
              {
                session,
                handleClose: () => {
                  doneCallback()
                },
                changeManager,
                sourceFeature: feature,
                sourceAssemblyId: currentAssemblyId,
                selectedFeature,
                setSelectedFeature,
              },
            ],
          )
        },
      },
      {
        label: 'Edit attributes',
        disabled: readOnly,
        onClick: () => {
          ;(session as unknown as AbstractSessionModel).queueDialog(
            (doneCallback) => [
              ModifyFeatureAttribute,
              {
                session,
                handleClose: () => {
                  doneCallback()
                },
                changeManager,
                sourceFeature: feature,
                sourceAssemblyId: currentAssemblyId,
              },
            ],
          )
        },
      },
    )
  }
  return menuItems
}
