/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import {
  type AnnotationFeature,
  AnnotationFeatureModel,
} from '@apollo-annotation/mst'
import { getSession } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import {
  type Instance,
  type SnapshotIn,
  addDisposer,
  types,
} from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { ApolloSessionModel } from '../session'

export const ApolloFeatureDetailsWidgetModel = types
  .model('ApolloFeatureDetailsWidget', {
    id: ElementId,
    type: types.literal('ApolloFeatureDetailsWidget'),
    feature: types.maybe(
      types.reference(AnnotationFeatureModel, {
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
    setFeature(feature: AnnotationFeature) {
      // @ts-expect-error Not sure why TS thinks these MST types don't match
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

// eslint disables because of
// https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ApolloFeatureDetailsWidget
  extends Instance<typeof ApolloFeatureDetailsWidgetModel> {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ApolloFeatureDetailsWidgetSnapshot
  extends SnapshotIn<typeof ApolloFeatureDetailsWidgetModel> {}

export const ApolloTranscriptDetailsModel = types
  .model('ApolloTranscriptDetails', {
    id: ElementId,
    type: types.literal('ApolloTranscriptDetails'),
    feature: types.maybe(
      types.reference(AnnotationFeatureModel, {
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
    setFeature(feature: AnnotationFeature) {
      // @ts-expect-error Not sure why TS thinks these MST types don't match
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

// eslint disables because of
// https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ApolloTranscriptDetailsWidget
  extends Instance<typeof ApolloTranscriptDetailsModel> {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ApolloTranscriptDetailsWidgetSnapshot
  extends SnapshotIn<typeof ApolloTranscriptDetailsModel> {}
