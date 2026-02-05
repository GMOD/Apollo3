import { type Instance, getParent, types } from '@jbrowse/mobx-state-tree'

import { type DisplayStateModel } from './types'

export const TabularEditorStateModelType = types
  .model('TabularEditor', {
    isShown: true,
    featureCollapsed: types.map(types.boolean),
    filterText: '',
  })
  .actions((self) => ({
    setFeatureCollapsed(id: string, state: boolean) {
      self.featureCollapsed.set(id, state)
    },
    setFilterText(text: string) {
      self.filterText = text
    },
    clearFilterText() {
      self.filterText = ''
    },
    collapseAllFeatures() {
      // iterate over all seen features and set them to collapsed
      const display = getParent<DisplayStateModel>(self)
      for (const [featureId] of display.seenFeatures.entries()) {
        self.featureCollapsed.set(featureId, true)
      }
    },
    togglePane() {
      self.isShown = !self.isShown
    },
    hidePane() {
      self.isShown = false
    },
    showPane() {
      self.isShown = true
    },
    // onPatch(patch: any) {
    //   console.log(patch)
    // },
  }))

// eslint disable because of
// https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TabularEditorStateModel
  extends Instance<typeof TabularEditorStateModelType> {}
