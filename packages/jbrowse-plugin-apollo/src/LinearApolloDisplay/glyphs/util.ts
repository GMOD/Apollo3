import { type ContentBlock } from '@jbrowse/core/util/blockTypes'

import { type LinearApolloDisplay } from '../stateModel'

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
