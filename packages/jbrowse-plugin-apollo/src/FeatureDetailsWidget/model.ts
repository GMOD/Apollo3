import { ElementId } from '@jbrowse/core/util/types/mst'
import { AnnotationFeature } from 'apollo-mst'
import { Instance, SnapshotIn, types } from 'mobx-state-tree'

export const ApolloFeatureDetailsWidgetModel = types.model(
  'ApolloFeatureDetailsWidget',
  {
    id: ElementId,
    type: types.literal('ApolloFeatureDetailsWidget'),
    feature: types.safeReference(AnnotationFeature),
    assembly: types.string,
    refName: types.string,
  },
)

export type ApolloFeatureDetailsWidget = Instance<
  typeof ApolloFeatureDetailsWidgetModel
>
export type ApolloFeatureDetailsWidgetSnapshot = SnapshotIn<
  typeof ApolloFeatureDetailsWidgetModel
>
