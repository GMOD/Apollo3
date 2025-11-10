import { type CheckResultI } from '@apollo-annotation/mst'
import { type AbstractSessionModel, doesIntersect2 } from '@jbrowse/core/util'
import ErrorIcon from '@mui/icons-material/Error'
import { Avatar, Badge, Box, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import React from 'react'

import { clusterResultByMessage, useStyles } from '../../util/displayUtils'
import { type LinearApolloDisplay as LinearApolloDisplayI } from '../stateModel'

export const CheckResultWarnings = observer(function CheckResultWarnings({
  display,
}: {
  display: LinearApolloDisplayI
}) {
  const { classes } = useStyles()
  const { apolloDragging, apolloRowHeight, lgv, session, showCheckResults } =
    display
  return lgv.displayedRegions.flatMap((region, idx) => {
    const widthBp = lgv.bpPerPx * apolloRowHeight
    const { assemblyManager } = session as unknown as AbstractSessionModel
    const assembly = assemblyManager.get(region.assemblyName)
    if (showCheckResults) {
      const filteredCheckResults = [
        ...session.apolloDataStore.checkResults.values(),
      ].filter(
        (checkResult) =>
          assembly?.isValidRefName(checkResult.refSeq) &&
          assembly.getCanonicalRefName(checkResult.refSeq) === region.refName &&
          doesIntersect2(
            region.start,
            region.end,
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
        const left =
          (lgv.bpToPx({
            refName: region.refName,
            coord: checkResult.start,
            regionNumber: idx,
          })?.offsetPx ?? 0) - lgv.offsetPx
        const [feature] = checkResult.featureIds
        if (!feature) {
          return null
        }
        let row = 0
        const featureLayout = display.getFeatureLayoutPosition(feature)
        if (featureLayout) {
          row = featureLayout.layoutRow + featureLayout.featureRow
        }
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
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
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
    }
    return null
  })
})
