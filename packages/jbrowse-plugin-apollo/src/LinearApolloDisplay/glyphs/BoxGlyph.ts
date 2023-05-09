import { AnnotationFeatureI } from 'apollo-mst'

import { Glyph } from './Glyph'

export class BoxGlyph extends Glyph {
  getRowCount() {
    return 1
  }

  draw(
    feature: AnnotationFeatureI,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    bpPerPx: number,
    rowHeight: number,
    reversed?: boolean,
  ) {
    const width = feature.end - feature.start
    const widthPx = width / bpPerPx
    const startBp = reversed
      ? feature.max - feature.end
      : feature.start - feature.min
    const startPx = startBp / bpPerPx
    ctx.fillStyle = 'black'
    ctx.fillRect(x + startPx, y, widthPx, rowHeight)
    if (widthPx > 2) {
      ctx.clearRect(x + startPx + 1, y + 1, widthPx - 2, rowHeight - 2)
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.fillRect(x + startPx + 1, y + 1, widthPx - 2, rowHeight - 2)
      ctx.fillStyle = 'black'
      feature.type &&
        ctx.fillText(feature.type, x + startPx + 1, y + 11, widthPx - 2)
    }
  }

  getFeatureFromLayout(feature: AnnotationFeatureI, _bp: number, _row: number) {
    return feature
  }
}
