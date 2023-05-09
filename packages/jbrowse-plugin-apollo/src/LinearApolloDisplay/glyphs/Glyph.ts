import { AnnotationFeatureI } from 'apollo-mst'

export abstract class Glyph {
  abstract rowCount: number
  abstract draw(
    feature: AnnotationFeatureI,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    bpPerPx: number,
    rowHeight: number,
    reversed?: boolean,
  ): void
  abstract getFeatureFromLayout(
    feature: AnnotationFeatureI,
    bp: number,
    row: number,
  ): AnnotationFeatureI | undefined
}
