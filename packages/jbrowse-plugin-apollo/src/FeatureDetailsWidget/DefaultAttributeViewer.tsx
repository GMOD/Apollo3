import type { AttributeViewerProps } from '@apollo-annotation/common/client'
import { Typography } from '@mui/material'
import React from 'react'

export type { AttributeViewerProps } from '@apollo-annotation/common/client'

export function DefaultAttributeViewer({ values }: AttributeViewerProps) {
  return (
    <>
      {values?.map((value, idx) => (
        <Typography
          // eslint-disable-next-line @eslint-react/no-array-index-key
          key={`${idx}.${value}`}
          variant="body2"
          color="textSecondary"
        >
          {value}
        </Typography>
      ))}
    </>
  )
}
