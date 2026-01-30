import {
  gffInternalToColumn,
  internalToGFF,
  isGFFColumnInternal,
  isGFFInternalAttribute,
} from '@apollo-annotation/shared'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import InfoIcon from '@mui/icons-material/Info'
import { Chip, Tooltip, Typography } from '@mui/material'
import React from 'react'

const useStyles = makeStyles()((theme) => ({
  attributeKey: {
    fontWeight: 'bold',
    marginRight: theme.spacing(2),
  },
}))

export function AttributeKey({ attributeKey: key }: { attributeKey: string }) {
  const { classes } = useStyles()

  const startsWithCapital = /^[A-Z]/.test(key)
  let displayKey = key
  let titleText: string | undefined
  if (isGFFInternalAttribute(key)) {
    displayKey = internalToGFF[key]
    titleText = `On GFF3 export, this will be assigned to the GFF3's reserved "${displayKey}" attribute`
  } else if (isGFFColumnInternal(key)) {
    displayKey = gffInternalToColumn[key]
    titleText = `On GFF3 export, this will be placed in the GFF3's "${displayKey}" column`
  } else if (startsWithCapital) {
    titleText =
      'On GFF3 export, this attribute will be changed to start with a lower-case letter because attributes starting with an upper-case letter are reserved in GFF3'
  }
  return (
    <div style={{ display: 'flex' }}>
      <Typography className={classes.attributeKey}>{displayKey}</Typography>
      {titleText ? (
        <Tooltip title={titleText}>
          <Chip
            icon={<InfoIcon />}
            label="GFF3"
            size="small"
            variant="outlined"
          />
        </Tooltip>
      ) : null}
    </div>
  )
}
