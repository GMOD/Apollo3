import ErrorIcon from '@mui/icons-material/Error'
import { Avatar, Badge, Tooltip } from '@mui/material'
import React, { memo } from 'react'

import { useStyles } from '../util/displayUtils'

interface CheckResultIconProps {
  message: string
  count: number
  start: number
}

/**
 * The warning icon for a cluster of check results. It's memoized so moving the
 * icon while zooming or scrolling, which only changes the position of the
 * element around it, doesn't re-render its tooltip, badge, and avatar.
 */
const CheckResultIconContent = memo(function CheckResultIconContent({
  message,
  count,
  start,
}: CheckResultIconProps) {
  const { classes } = useStyles()
  return (
    <Tooltip title={message}>
      <Badge
        className={classes.badge}
        badgeContent={count}
        color="primary"
        overlap="circular"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        invisible={count <= 1}
      >
        <Avatar className={classes.avatar}>
          <ErrorIcon data-testid={`ErrorIcon-${start}`} />
        </Avatar>
      </Badge>
    </Tooltip>
  )
})

export function CheckResultIcon({
  top,
  left,
  size,
  disablePointerEvents,
  ...contentProps
}: CheckResultIconProps & {
  top: number
  left: number
  size: number
  disablePointerEvents: boolean
}) {
  return (
    <div
      style={{
        position: 'absolute',
        overflow: 'visible',
        top,
        left,
        height: size,
        width: size,
        pointerEvents: disablePointerEvents ? 'none' : 'auto',
      }}
    >
      <CheckResultIconContent {...contentProps} />
    </div>
  )
}
