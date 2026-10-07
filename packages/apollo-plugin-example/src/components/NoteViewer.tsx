import type { AttributeViewerProps } from '@apollo-annotation/common/client'
import { Box, Typography } from '@mui/material'
import React from 'react'

/** Shows each note in a highlighted callout so notes stand out */
export function NoteViewer({ values }: AttributeViewerProps) {
  return (
    <>
      {values?.map((note, idx) => (
        <Box
          key={`${idx}.${note}`}
          sx={{
            my: 0.5,
            px: 1,
            py: 0.5,
            borderLeft: 4,
            borderColor: 'warning.main',
            borderRadius: 1,
            bgcolor: 'action.hover',
          }}
        >
          <Typography
            variant="body2"
            sx={{ fontStyle: 'italic', whiteSpace: 'pre-wrap' }}
          >
            {note}
          </Typography>
        </Box>
      ))}
    </>
  )
}
