import { AnnotationFeatureI } from 'apollo-mst'
import { ObservableMap, observable } from 'mobx'
import { types } from 'mobx-state-tree'

import { BoxGlyph } from '../glyphs/BoxGlyph'
import { Glyph } from '../glyphs/Glyph'

export default function Glyphs() {
  return types
    .model({})
    .volatile(() => ({
      glyphs: observable.map<number, ObservableMap<string, Glyph>>(),
    }))
    .actions((s) => {
      const self = s
      return {
        getGlyphsForZoomLevel(bpPerPx: number): ObservableMap<string, Glyph> {
          const existingZoomLevel = self.glyphs.get(bpPerPx)
          if (existingZoomLevel) {
            return existingZoomLevel
          }
          const newZoomLevel = observable.map()
          self.glyphs.set(bpPerPx, newZoomLevel)
          return newZoomLevel
        },
        createGlyph() {
          return new BoxGlyph()
        },
        /** get the appropriate glyph for the given top-level feature */
        getGlyph(feature: AnnotationFeatureI, bpPerPx: number) {
          const glyphsForZoomLevel = this.getGlyphsForZoomLevel(bpPerPx)
          const glyphForFeature = glyphsForZoomLevel.get(feature._id)
          if (glyphForFeature) {
            return glyphForFeature
          }
          const newGlyph = this.createGlyph(feature, bpPerPx)
          glyphsForZoomLevel.set(feature._id, newGlyph)
          return newGlyph
        },
        afterAttach() {
          // autorun to clean up old glyph zoom levels
        },
      }
    })
}
