import { MenuItem } from '@jbrowse/core/ui'
import { AbstractSessionModel } from '@jbrowse/core/util'
import { AnnotationFeatureI } from 'apollo-mst'

import { ChangeManager } from '../../ChangeManager'
import {
  AddFeature,
  CopyFeature,
  DeleteFeature,
  ModifyFeatureAttribute,
} from '../../components'
import { getApolloInternetAccount } from '../../util'

export function featureContextMenuItems(
  feature: AnnotationFeatureI | undefined,
  region: {
    assemblyName: string
    refName: string
    start: number
    end: number
  },
  getAssemblyId: (assemblyName: string) => string,
  selectedFeature: AnnotationFeatureI | undefined,
  setSelectedFeature: (f: AnnotationFeatureI | undefined) => void,
  session: AbstractSessionModel,
  changeManager: ChangeManager,
) {
  const internetAccount = getApolloInternetAccount(session)
  const { getRole } = internetAccount
  const role = getRole()
  const admin = role === 'admin'
  const readOnly = !Boolean(role && ['admin', 'user'].includes(role))
  const menuItems: MenuItem[] = []
  if (feature) {
    const sourceAssemblyId = getAssemblyId(region.assemblyName)
    const currentAssemblyId = getAssemblyId(region.assemblyName)
    menuItems.push(
      {
        label: 'Add child feature',
        disabled: readOnly,
        onClick: () => {
          session.queueDialog((doneCallback) => [
            AddFeature,
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
          ])
        },
      },
      {
        label: 'Copy features and annotations',
        disabled: readOnly,
        onClick: () => {
          session.queueDialog((doneCallback) => [
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
          ])
        },
      },
      {
        label: 'Delete feature',
        disabled: !admin,
        onClick: () => {
          session.queueDialog((doneCallback) => [
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
          ])
        },
      },
      {
        label: 'Modify feature attribute',
        disabled: readOnly,
        onClick: () => {
          session.queueDialog((doneCallback) => [
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
          ])
        },
      },
    )
  }
  return menuItems
}
