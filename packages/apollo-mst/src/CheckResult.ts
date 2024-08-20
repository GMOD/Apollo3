import { Instance, SnapshotIn, types } from 'mobx-state-tree'

import { AnnotationFeatureModel } from './AnnotationFeatureModel'

export const CheckResult = types.model('CheckResult', {
  _id: types.identifier,
  name: types.string,
  ids: types.array(types.safeReference(AnnotationFeatureModel)),
  refSeq: types.string,
  start: types.number,
  end: types.number,
  ignored: false,
  message: types.string,
})

// eslint disables because of
// https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CheckResultI extends Instance<typeof CheckResult> {}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CheckResultSnapshot extends SnapshotIn<typeof CheckResult> {}
