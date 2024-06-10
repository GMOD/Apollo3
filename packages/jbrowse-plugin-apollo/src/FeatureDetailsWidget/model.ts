/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { AnnotationFeature, AnnotationFeatureI } from '@apollo-annotation/mst'
import { getSession } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { autorun } from 'mobx'
import { Instance, SnapshotIn, addDisposer, types } from 'mobx-state-tree'

import { ApolloSessionModel } from '../session'

export const ApolloFeatureDetailsWidgetModel = types
  .model('ApolloFeatureDetailsWidget', {
    id: ElementId,
    type: types.literal('ApolloFeatureDetailsWidget'),
    feature: types.maybe(
      types.reference(AnnotationFeature, {
        onInvalidated(ev) {
          ev.parent.setTryReload(ev.invalidId)
          ev.removeRef()
        },
      }),
    ),
    assembly: types.string,
    refName: types.string,
  })
  .volatile(() => ({
    tryReload: undefined as string | undefined,
  }))
  .actions((self) => ({
    setFeature(feature: AnnotationFeatureI) {
      self.feature = feature
    },
    setTryReload(featureId?: string) {
      self.tryReload = featureId
    },
  }))
  .actions((self) => ({
    afterAttach() {
      addDisposer(
        self,
        autorun((reaction) => {
          if (!self.tryReload) {
            return
          }
          const session = getSession(self) as unknown as ApolloSessionModel
          const { apolloDataStore } = session
          if (!apolloDataStore) {
            return
          }
          const feature = apolloDataStore.getFeature(self.tryReload)
          if (feature) {
            self.setFeature(feature)
            self.setTryReload()
            reaction.dispose()
          }
        }),
      )
    },
  }))

export type ApolloFeatureDetailsWidget = Instance<
  typeof ApolloFeatureDetailsWidgetModel
>
export type ApolloFeatureDetailsWidgetSnapshot = SnapshotIn<
  typeof ApolloFeatureDetailsWidgetModel
>
