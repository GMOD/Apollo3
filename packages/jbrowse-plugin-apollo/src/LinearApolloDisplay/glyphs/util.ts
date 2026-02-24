import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

import type { LinearApolloDisplay } from '../stateModel'

export function getLeftPx(
  display: LinearApolloDisplay,
  feature: { max: number; min: number },
  block: ContentBlock,
) {
  const { lgv } = display
  const { bpPerPx, offsetPx } = lgv
  const blockLeftPx = block.offsetPx - offsetPx
  const featureLeftBpDistanceFromBlockLeftBp = block.reversed
    ? block.end - feature.max
    : feature.min - block.start
  const featureLeftPxDistanceFromBlockLeftPx =
    featureLeftBpDistanceFromBlockLeftBp / bpPerPx
  return blockLeftPx + featureLeftPxDistanceFromBlockLeftPx
}

/**
 * Perform a canvas strokeRect, but have the stroke be contained within the
 * given rect instead of centered on it.
 */
export function strokeRectInner(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
  color: string,
) {
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.strokeRect(left + 0.5, top + 0.5, width - 1, height - 1)
}
