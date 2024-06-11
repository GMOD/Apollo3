import { AnnotationFeature } from '@apollo-annotation/mst'
import { MenuItem } from '@jbrowse/core/ui'
import { AbstractSessionModel, SessionWithWidgets } from '@jbrowse/core/util'

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
  feature: AnnotationFeature | undefined,
  region: { assemblyName: string; refName: string; start: number; end: number },
  getAssemblyId: (assemblyName: string) => string,
  selectedFeature: AnnotationFeature | undefined,
  setSelectedFeature: (f: AnnotationFeature | undefined) => void,
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
        label: 'Edit feature details',
        onClick: () => {
          const apolloFeatureWidget = (
            session as unknown as SessionWithWidgets
          ).addWidget(
            'ApolloFeatureDetailsWidget',
            'apolloFeatureDetailsWidget',
            {
              feature,
              assembly: currentAssemblyId,
              refName: region.refName,
            },
          )
          ;(session as unknown as SessionWithWidgets).showWidget(
            apolloFeatureWidget,
          )
        },
      },
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
    if (feature.type === 'mRNA') {
      menuItems.push({
        label: 'Edit transcript details',
        onClick: () => {
          const ses = session as unknown as AbstractSessionModel
          if (ses) {
            const sesWidged = session as unknown as SessionWithWidgets
            const apolloTranscriptWidget = sesWidged.addWidget(
              'ApolloTranscriptDetails',
              'apolloTranscriptDetails',
              {
                feature,
                assembly: currentAssemblyId,
                changeManager,
                refName: region.refName,
              },
            )
            ses.showWidget?.(apolloTranscriptWidget)
          }
        },
      })
    }
  }
  return menuItems
}
