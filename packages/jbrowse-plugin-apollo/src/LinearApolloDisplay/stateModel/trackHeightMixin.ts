// TODO: get this added to LGV runtime exports so we don't have to duplicate it
import { getConf } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

const minDisplayHeight = 20

/**
 * #stateModel TrackHeightMixin
 * #category display
 */
export const TrackHeightMixin = types
  .model({
    heightPreConfig: types.maybe(
      types.refinement(
        'displayHeight',
        types.number,
        (n) => n >= minDisplayHeight,
      ),
    ),
  })
  .volatile(() => ({
    scrollTop: 0,
  }))
  .views((self) => ({
    get height() {
      // @ts-expect-error getConf needs self.configuration
      return self.heightPreConfig ?? (getConf(self, 'height') as number)
    },
  }))
  .actions((self) => ({
    setScrollTop(scrollTop: number) {
      self.scrollTop = scrollTop
    },
    setHeight(displayHeight: number) {
      self.heightPreConfig = Math.max(displayHeight, minDisplayHeight)
      return self.height
    },
    resizeHeight(distance: number) {
      const oldHeight = self.height
      const newHeight = this.setHeight(self.height + distance)
      return newHeight - oldHeight
    },
  }))
