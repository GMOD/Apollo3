import { Typography } from '@mui/material'
import React from 'react'

export interface AttributeViewerProps {
  values: string[] | undefined
}

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
