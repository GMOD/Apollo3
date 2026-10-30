import type { CheckResultI } from '@apollo-annotation/mst'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { type AbstractSessionModel, doesIntersect2 } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import React from 'react'

import { CheckResultIcon } from '../../components/CheckResultIcon'
import { clusterResultByMessage } from '../../util/displayUtils'
import { getLeftPx } from '../glyphs/util'
import type { LinearApolloDisplay as LinearApolloDisplayI } from '../stateModel'

export const CheckResultWarnings = observer(function CheckResultWarnings({
  display,
}: {
  display: LinearApolloDisplayI
}) {
  const { apolloDragging, apolloRowHeight, lgv, session, showCheckResults } =
    display
  const { assemblyManager } = session as unknown as AbstractSessionModel
  if (!showCheckResults) {
    return null
  }
  return lgv.dynamicBlocks.contentBlocks.map((block) => {
    const widthBp = lgv.bpPerPx * apolloRowHeight
    const assembly = assemblyManager.get(block.assemblyName) as
      | Assembly
      | undefined
    if (!assembly) {
      return null
    }
    const filteredCheckResults = [
      ...session.apolloDataStore.checkResults.values(),
    ].filter(
      (checkResult) =>
        assembly.isValidRefName(checkResult.refSeq) &&
        assembly.getCanonicalRefName(checkResult.refSeq) === block.refName &&
        doesIntersect2(
          block.start,
          block.end,
          checkResult.start,
          checkResult.end,
        ),
    )
    const checkResults = clusterResultByMessage<CheckResultI>(
      filteredCheckResults,
      widthBp,
      true,
    )
    return checkResults.map((checkResult) => {
      const left = Math.round(getLeftPx(display, checkResult.range, block))

      const [feature] = checkResult.featureIds
      if (!feature) {
        return null
      }
      const row = display.getRowForFeature(feature) ?? 0
      return (
        <CheckResultIcon
          key={checkResult._id}
          top={row * apolloRowHeight}
          left={left}
          size={apolloRowHeight}
          disablePointerEvents={Boolean(apolloDragging)}
          message={checkResult.message}
          count={checkResult.count}
          start={checkResult.start}
        />
      )
    })
    return null
  })
})
