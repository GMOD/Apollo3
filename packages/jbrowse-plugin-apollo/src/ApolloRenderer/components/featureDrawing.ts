import { AnnotationFeatureI } from 'apollo-mst'

function getFeaturesForRow(
  feature: AnnotationFeatureI,
): AnnotationFeatureI[][] {
  const features = [[feature]]
  if (feature.children) {
    feature.children.forEach((child) => {
      features.push(...getFeaturesForRow(child))
    })
  }
  return features
}

export function getFeatureRowCount(feature: AnnotationFeatureI) {
  return getFeaturesForRow(feature).length
}

export function draw(
  feature: AnnotationFeatureI,
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bpPerPx: number,
  rowHeight: number,
  reversed?: boolean,
) {
  const featureRows = getFeaturesForRow(feature)
  for (let i = 0; i < featureRows.length; i++) {
    drawRow(
      featureRows[i],
      feature,
      ctx,
      x,
      y + i * rowHeight,
      bpPerPx,
      rowHeight,
      reversed,
    )
  }
}

function drawRow(
  featureRow: AnnotationFeatureI[],
  parentFeature: AnnotationFeatureI,
  ctx: CanvasRenderingContext2D,
  xOffset: number,
  yOffset: number,
  bpPerPx: number,
  rowHeight: number,
  reversed?: boolean,
) {
  featureRow.forEach((feature) => {
    const width = feature.end - feature.start
    const widthPx = width / bpPerPx
    const startBp = reversed
      ? parentFeature.end - feature.end
      : feature.start - parentFeature.start
    const startPx = startBp / bpPerPx
    const rowCount = getFeatureRowCount(feature)
    if (rowCount > 1) {
      const featureHeight = rowCount * rowHeight
      ctx.fillStyle = 'rgba(255,0,0,0.25)'
      ctx.fillRect(xOffset + startPx, yOffset, widthPx, featureHeight)
    }
    ctx.fillStyle = 'black'
    ctx.fillRect(xOffset + startPx, yOffset, widthPx, rowHeight)
    if (widthPx > 2) {
      ctx.clearRect(
        xOffset + startPx + 1,
        yOffset + 1,
        widthPx - 2,
        rowHeight - 2,
      )
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.fillRect(
        xOffset + startPx + 1,
        yOffset + 1,
        widthPx - 2,
        rowHeight - 2,
      )
      ctx.fillStyle = 'black'
      feature.type &&
        ctx.fillText(
          feature.type,
          xOffset + startPx + 1,
          yOffset + 11,
          widthPx - 2,
        )
    }
  })
  if (featureRow.length > 1) {
    let [{ start, end }] = featureRow
    featureRow.forEach((feature) => {
      start = Math.min(start, feature.start)
      end = Math.max(end, feature.end)
    })
    const width = end - start
    const startPx = (start - parentFeature.start) / bpPerPx
    const widthPx = width / bpPerPx
    ctx.fillStyle = 'rgba(0,255,255,0.2)'
    ctx.fillRect(xOffset + startPx + 1, yOffset + 1, widthPx - 2, rowHeight - 2)
  }
}

export function getFeatureFromLayout(
  feature: AnnotationFeatureI,
  x: number,
  y: number,
  bpPerPx: number,
  rowHeight: number,
) {
  const bp = bpPerPx * x + feature.start
  const row = Math.floor(y / rowHeight)
  const layoutRow = getFeaturesForRow(feature)[row]
  return layoutRow.find((f) => bp >= f.start && bp <= f.end)
}
