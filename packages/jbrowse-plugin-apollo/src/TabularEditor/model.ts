import { Instance, getParent, types } from 'mobx-state-tree'

import { DisplayStateModel } from './types'

export const TabularEditorStateModelType = types
  .model('TabularEditor', {
    isShown: false,
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

export type TabularEditorStateModel = Instance<
  typeof TabularEditorStateModelType
>
