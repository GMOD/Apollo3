import type { CheckResultI } from '@apollo-annotation/mst'
import { doesIntersect2 } from '@jbrowse/core/util'
import ErrorIcon from '@mui/icons-material/Error'
import { Avatar, Badge, Box, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import React from 'react'

import { clusterResultByMessage, useStyles } from '../../util/displayUtils'
import { getLeftPx } from '../glyphs/util'
import type { LinearApolloDisplay as LinearApolloDisplayI } from '../stateModel'

export const CheckResultWarnings = observer(function CheckResultWarnings({
  display,
}: {
  display: LinearApolloDisplayI
}) {
  const { classes } = useStyles()
  const { apolloDragging, apolloRowHeight, lgv, session, showCheckResults } =
    display
  if (!showCheckResults) {
    return null
  }
  return lgv.dynamicBlocks.contentBlocks.map((block) => {
    const widthBp = lgv.bpPerPx * apolloRowHeight
    const assemblyId = display.getAssemblyId(block.assemblyName)
    const filteredCheckResults = [
      ...session.apolloDataStore.checkResults.values(),
    ].filter((checkResult) => {
      // A checkResult's refSeq is the backend's internal refSeq id, not a
      // display refName, so it has to be resolved the same way features
      // are (via the display's own assembly/refSeq lookup) rather than
      // through the JBrowse assembly, which only knows about names.
      let canonicalRefName: string
      try {
        canonicalRefName = display.getCanonicalRefName(
          assemblyId,
          checkResult.refSeq,
        )
      } catch {
        return false
      }
      return (
        canonicalRefName === block.refName &&
        doesIntersect2(
          block.start,
          block.end,
          checkResult.start,
          checkResult.end,
        )
      )
    })
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
      const top = row * apolloRowHeight
      const height = apolloRowHeight
      return (
        <Tooltip key={checkResult._id} title={checkResult.message}>
          <Box
            className={classes.box}
            style={{
              top,
              left,
              height,
              width: height,
              pointerEvents: apolloDragging ? 'none' : 'auto',
            }}
          >
            <Badge
              className={classes.badge}
              badgeContent={checkResult.count}
              color="primary"
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              invisible={checkResult.count <= 1}
            >
              <Avatar className={classes.avatar}>
                <ErrorIcon data-testid={`ErrorIcon-${checkResult.start}`} />
              </Avatar>
            </Badge>
          </Box>
        </Tooltip>
      )
    })
    return null
  })
})
