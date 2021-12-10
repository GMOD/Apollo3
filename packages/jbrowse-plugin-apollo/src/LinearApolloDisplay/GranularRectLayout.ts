import {
  RectTuple,
  SerializedLayout,
} from '@jbrowse/core/util/layouts/BaseLayout'
import { Instance, types } from 'mobx-state-tree'

/**
 * Rectangle-layout manager that lays out rectangles using bitmaps at
 * resolution that, for efficiency, may be somewhat lower than that of
 * the coordinate system for the rectangles being laid out.  `pitchX`
 * and `pitchY` are the ratios of input scale resolution to internal
 * bitmap resolution.
 */

export const objectFromEntries = Object.fromEntries.bind(Object)

// minimum excess size of the array at which we garbage collect
const minSizeToBotherWith = 10000
const maxFeaturePitchWidth = 20000

function segmentsIntersect(
  x1: number,
  x2: number,
  y1: number,
  y2: number,
): boolean {
  return x2 >= y1 && y2 >= x1
}

const rectangle = types.model({
  id: types.string,
  l: types.number,
  r: types.number,
  top: types.maybeNull(types.number),
  h: types.number,
  originalHeight: types.number,
  data: types.frozen(), // types.maybe(types.map(types.frozen())),
})
const rowState = types.model({
  min: types.number,
  max: types.number,
  offset: types.number,
  bits: types.array(
    types.union(types.map(types.frozen()), types.string, types.undefined),
  ),
  // bits: types.frozen(), // types.array(types.frozen()),
})

export const LayoutRow = types
  .model('LayoutRow', {
    id: 'LayoutRow',
    type: types.optional(types.literal('LayoutRow'), 'LayoutRow'),
    allFilled: types.maybe(
      types.union(types.map(types.frozen()), types.string),
    ),
    rowState: types.maybe(rowState),
    padding: 1,
    widthLimit: 10000,
  })
  .actions((self) => ({
    setAllFilled(data: string[]): void {
      self.allFilled = data
    },
    getItemAt(x: number): any {
      if (self.allFilled) {
        return self.allFilled
      }
      if (!self.rowState) {
        return undefined
      }

      if (self.rowState.min === undefined) {
        return undefined
      }
      if (x < self.rowState.min) {
        return undefined
      }
      if (x >= self.rowState.max) {
        return undefined
      }
      const offset = x - self.rowState.offset
      // if (offset < 0)
      //     debugger
      // if (offset >= this.rowState.bits.length)
      //     debugger
      return self.rowState.bits[offset]
    },

    isRangeClear(left: number, right: number): boolean {
      if (self.allFilled) {
        return false
      }

      if (!self.rowState) {
        return true
      }

      const { min, max } = self.rowState

      if (right <= min || left >= max) {
        return true
      }

      // TODO: check right and middle before looping
      const maxX = Math.min(max, right)
      let x = Math.max(min, left)
      for (; x < right && x < maxX; x += 1) {
        if (this.getItemAt(x)) {
          return false
        }
      }

      return true
    },
    initialize(left: number, right: number): Instance<typeof rowState> {
      // NOTE: this.rowState.min, this.rowState.max, and this.rowState.offset are interbase coordinates
      const rectWidth = right - left
      return {
        offset: left - rectWidth,
        min: left,
        max: right,
        bits: new Array(3 * rectWidth) as any,
      }
      // this.log(`initialize ${this.rowState.min} - ${this.rowState.max} (${this.rowState.bits.length})`)
    },
    addRect(rect: Instance<typeof rectangle>, data: string[] | []): void {
      const left = rect.l
      const right = rect.r + self.padding // only padding on the right
      if (!self.rowState) {
        self.rowState = this.initialize(left, right)
      }

      // or check if we need to expand to the left and/or to the right

      let oLeft = left - self.rowState.offset
      let oRight = right - self.rowState.offset
      const currLength = self.rowState.bits.length
      // console.log(oRight, this.rowState.bits.length)

      // expand rightward if necessary
      if (oRight >= self.rowState.bits.length) {
        const additionalLength = oRight + 1
        if (self.rowState.bits.length + additionalLength > self.widthLimit) {
          console.warn(
            'Layout width limit exceeded, discarding old layout. Please be more careful about discarding unused blocks.',
          )
          self.rowState = this.initialize(left, right)
        } else if (additionalLength > 0) {
          self.rowState.bits = self.rowState.bits.concat(
            new Array(additionalLength),
          ) as any
        }
      }

      // expand leftward if necessary
      if (left < self.rowState.offset) {
        // use math.min to avoid negative lengths
        const additionalLength = Math.min(
          currLength - oLeft,
          self.rowState.offset,
        )
        if (self.rowState.bits.length + additionalLength > self.widthLimit) {
          console.warn(
            'Layout width limit exceeded, discarding old layout. Please be more careful about discarding unused blocks.',
          )

          self.rowState = this.initialize(left, right)
        } else {
          self.rowState.bits = new Array(additionalLength).concat(
            self.rowState.bits,
          ) as any
          self.rowState.offset -= additionalLength
        }
      }
      oRight = right - self.rowState.offset
      oLeft = left - self.rowState.offset

      // set the bits in the bitmask
      // if (oLeft < 0) debugger
      // if (oRight < 0) debugger
      // if (oRight <= oLeft) debugger
      // if (oRight > this.rowState.bits.length) debugger
      if (oRight - oLeft > maxFeaturePitchWidth) {
        console.warn(
          `Layout X pitch set too low, feature spans ${
            oRight - oLeft
          } bits in a single row.`,
          rect,
          data,
        )
      }

      for (let x = oLeft; x < oRight; x += 1) {
        // if (this.rowState.bits[x] && this.rowState.bits[x].get('name') !== data.get('name')) debugger
        self.rowState.bits[x] = data
      }

      if (left < self.rowState.min) {
        self.rowState.min = left
      }
      if (right > self.rowState.max) {
        self.rowState.max = right
      }
      // // this.log(`added ${leftX} - ${rightX}`)
    },
    discardRange(left: number, right: number): void {
      if (self.allFilled) {
        return
      } // allFilled is irrevocable currently

      // if we have no data, do nothing
      if (!self.rowState) {
        return
      }

      // if doesn't overlap at all, do nothing
      if (right <= self.rowState.min || left >= self.rowState.max) {
        return
      }

      // if completely encloses range, discard everything
      if (left <= self.rowState.min && right >= self.rowState.max) {
        self.rowState = undefined
        return
      }

      // if overlaps left edge, adjust the min
      if (right > self.rowState.min && left <= self.rowState.min) {
        self.rowState.min = right
      }

      // if overlaps right edge, adjust the max
      if (left < self.rowState.max && right >= self.rowState.max) {
        self.rowState.max = left
      }

      // now trim the left, right, or both sides of the array
      if (
        self.rowState.offset < self.rowState.min - minSizeToBotherWith &&
        self.rowState.bits.length >
          self.rowState.max + minSizeToBotherWith - self.rowState.offset
      ) {
        // trim both sides
        const leftTrimAmount = self.rowState.min - self.rowState.offset
        const rightTrimAmount =
          self.rowState.bits.length -
          1 -
          (self.rowState.max - self.rowState.offset)
        // if (rightTrimAmount <= 0) debugger
        // if (leftTrimAmount <= 0) debugger
        // self.log(`trim both sides, ${leftTrimAmount} from left, ${rightTrimAmount} from right`)
        self.rowState.bits = self.rowState.bits.slice(
          leftTrimAmount,
          self.rowState.bits.length - rightTrimAmount,
        ) as any
        self.rowState.offset += leftTrimAmount
        // if (self.rowState.offset > self.rowState.min) debugger
        // if (self.rowState.bits.length <= self.rowState.max - self.rowState.offset) debugger
      } else if (
        self.rowState.offset <
        self.rowState.min - minSizeToBotherWith
      ) {
        // trim left side
        const desiredOffset =
          self.rowState.min - Math.floor(minSizeToBotherWith / 2)
        const trimAmount = desiredOffset - self.rowState.offset
        // self.log(`trim left side by ${trimAmount}`)
        self.rowState.bits.splice(0, trimAmount)
        self.rowState.offset += trimAmount
        // if (self.rowState.offset > self.rowState.min) debugger
        // if (self.rowState.bits.length <= self.rowState.max - self.rowState.offset) debugger
      } else if (
        self.rowState.bits.length >
        self.rowState.max - self.rowState.offset + minSizeToBotherWith
      ) {
        // trim right side
        const desiredLength =
          self.rowState.max -
          self.rowState.offset +
          1 +
          Math.floor(minSizeToBotherWith / 2)
        // self.log(`trim right side by ${self.rowState.bits.length-desiredLength}`)
        // if (desiredLength > self.rowState.bits.length) debugger
        self.rowState.bits.length = desiredLength
        // if (self.rowState.offset > self.rowState.min) debugger
        // if (self.rowState.bits.length <= self.rowState.max - self.rowState.offset) debugger
      }

      // if (self.rowState.offset > self.rowState.min) debugger
      // if (self.rowState.bits.length <= self.rowState.max - self.rowState.offset) debugger

      // if range now enclosed in the new bounds, loop through and clear the bits
      const oLeft = Math.max(self.rowState.min, left) - self.rowState.offset
      // if (oLeft < 0) debugger
      // if (oLeft >= self.rowState.bits.length) debugger
      // if (oRight < 0) debugger
      // if (oRight >= self.rowState.bits.length) debugger

      const oRight = Math.min(right, self.rowState.max) - self.rowState.offset
      for (let x = oLeft; x >= 0 && x < oRight; x += 1) {
        self.rowState.bits[x] = undefined
      }
    },
  }))

export const GranularRectLayout = types
  .model('GranularRectLayout', {
    id: 'GranularRectLayout',
    type: types.optional(
      types.literal('GranularRectLayout'),
      'GranularRectLayout',
    ),
    bitmap: types.array(LayoutRow),
    pTotalHeight: 0,
    rectangles: types.map(rectangle),
    pitchX: 10,
    pitchY: 10,
    maxHeightReached: false,
    maxHeight: 10000,
    hardRowLimit: 10000,
  })
  .views((self) => ({
    hasSeen(id: string): boolean {
      return self.rectangles.has(id)
    },

    getByCoord(x: number, y: number): string[] | string | undefined {
      const pY = Math.floor(y / self.pitchY)
      const row = (self.bitmap as any)[pY]
      if (!row) {
        return undefined
      }
      const pX = Math.floor(x / self.pitchX)
      return row.getItemAt(pX)
    },

    getByID(id: string): RectTuple | undefined {
      const r = self.rectangles.get(id)
      if (r) {
        const t = (r.top as number) * self.pitchX
        return [r.l * self.pitchX, t, r.r * self.pitchX, t + r.originalHeight]
      }

      return undefined
    },

    get totalHeight(): number {
      return self.pTotalHeight * self.pitchY
    },

    getRectangles(): Map<string, RectTuple> {
      return new Map(
        Array.from(self.rectangles.entries()).map(([id, rect]) => {
          const { l, r, originalHeight, top } = rect
          const t = (top || 0) * self.pitchY
          const b = t + originalHeight
          return [id, [l * self.pitchX, t, r * self.pitchX, b]] // left, top, right, bottom
        }),
      )
    },

    serializeRegion(region: { start: number; end: number }): SerializedLayout {
      const regionRectangles: { [key: string]: RectTuple } = {}
      let maxHeightReached = false
      Array.from(self.rectangles.entries()).forEach(([id, rect]) => {
        const { l, r, originalHeight, top } = rect
        if (rect.top === null) {
          maxHeightReached = true
        } else {
          const t = (top || 0) * self.pitchY
          const b = t + originalHeight
          const y1 = l * self.pitchX
          const y2 = r * self.pitchX
          const x1 = region.start
          const x2 = region.end
          // add +/- pitchX to avoid resolution causing errors
          if (segmentsIntersect(x1, x2, y1 - self.pitchX, y2 + self.pitchX)) {
            regionRectangles[id] = [y1, t, y2, b]
          }
        }
      })
      return {
        rectangles: regionRectangles,
        totalHeight: this.totalHeight,
        maxHeightReached,
      }
    },

    toJSON(): SerializedLayout {
      const rectangles = objectFromEntries(this.getRectangles())
      return {
        rectangles,
        totalHeight: this.totalHeight,
        maxHeightReached: self.maxHeightReached,
      }
    },
  }))
  .actions((self) => ({
    /**
     * @returns top position for the rect, or Null if laying
     *  out the rect would exceed maxHeight
     */
    addRect(
      id: string,
      left: number,
      right: number,
      height: number,
      data?: any,
    ): number | null {
      // if we have already laid it out, return its layout
      const storedRec = self.rectangles.get(id)
      if (storedRec) {
        if (storedRec.top === null) {
          return null
        }

        // add it to the bitmap again, since that bitmap range may have been
        // discarded
        this.addRectToBitmap(storedRec)
        return storedRec.top * self.pitchY
      }

      const pLeft = Math.floor(left / self.pitchX)
      const pRight = Math.floor(right / self.pitchX)
      const pHeight = Math.ceil(height / self.pitchY)

      const addedRect: Instance<typeof rectangle> = {
        id,
        l: pLeft,
        r: pRight,
        top: null,
        h: pHeight,
        originalHeight: height,
        data,
      }

      const maxTop = self.maxHeight - pHeight
      let top = 0
      for (; top <= maxTop; top += 1) {
        if (!this.collides(addedRect, top)) {
          break
        }
      }

      if (top > maxTop) {
        addedRect.top = null
        self.rectangles.set(id, addedRect)
        self.maxHeightReached = true
        return null
      }

      addedRect.top = top
      this.addRectToBitmap(addedRect)
      self.rectangles.set(id, addedRect)
      self.pTotalHeight = Math.max(self.pTotalHeight || 0, top + pHeight)
      return top * self.pitchY
    },
    collides(rect: Instance<typeof rectangle>, top: number): boolean {
      const { bitmap } = self

      const maxY = top + rect.h
      for (let y = top; y < maxY; y += 1) {
        const row = bitmap[y]
        if (row && !row.isRangeClear(rect.l, rect.r)) {
          return true
        }
      }

      return false
    },
    addRectToBitmap(rect: Instance<typeof rectangle>): void {
      if (rect.top === null) {
        return
      }

      const data: string[] = rect.data || rect.id
      const { bitmap } = self
      const yEnd = rect.top + rect.h
      if (rect.r - rect.l > maxFeaturePitchWidth) {
        // the rect is very big in relation to the view size, just pretend, for
        // the purposes of layout, that it extends infinitely.  this will cause
        // weird layout if a user scrolls manually for a very, very long time
        // along the genome at the same zoom level.  but most users will not do
        // that.  hopefully.
        for (let y = rect.top; y < yEnd; y += 1) {
          this.autovivifyRow(bitmap, y).setAllFilled(data)
        }
      } else {
        for (let y = rect.top; y < yEnd; y += 1) {
          this.autovivifyRow(bitmap, y).addRect(rect, data)
        }
      }
    },
    /**
     * make a subarray if it does not exist
     */
    autovivifyRow(
      bitmap: Instance<typeof LayoutRow>[],
      y: number,
    ): Instance<typeof LayoutRow> {
      let row = bitmap[y]
      if (!row) {
        if (y > self.hardRowLimit) {
          throw new Error(
            `layout hard limit (${
              self.hardRowLimit * self.pitchY
            }px) exceeded, aborting layout`,
          )
        }
        row = LayoutRow.create({})
        bitmap[y] = row
      }
      return row
    },

    /**
     *  Given a range of X coordinates, deletes all data dealing with
     *  the features.
     */
    discardRange(left: number, right: number): void {
      // console.log( 'discard', left, right );
      const pLeft = Math.floor(left / self.pitchX)
      const pRight = Math.floor(right / self.pitchX)
      const { bitmap } = self
      for (let y = 0; y < bitmap.length; y += 1) {
        const row = bitmap[y]
        if (row) {
          row.discardRange(pLeft, pRight)
        }
      }
    },
  }))

export type LayoutRowStateModel = typeof LayoutRow
export type LayoutRowModel = Instance<LayoutRowStateModel>

export type GranularRectLayoutStateModel = typeof GranularRectLayout
export type GranularRectLayoutModel = Instance<GranularRectLayoutStateModel>
