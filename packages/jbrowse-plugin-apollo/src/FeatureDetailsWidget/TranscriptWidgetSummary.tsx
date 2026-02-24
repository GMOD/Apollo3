import type { AnnotationFeature } from '@apollo-annotation/mst'
import styled from '@emotion/styled'
import { Table, TableBody, TableCell, TableRow } from '@mui/material'
import { observer } from 'mobx-react'
import React from 'react'

import { getFeatureId, getFeatureName, getStrand } from '../util'

const HeaderTableCell = styled(TableCell)(() => ({
  fontWeight: 'bold',
}))

export const TranscriptWidgetSummary = observer(
  function TranscriptWidgetSummary(props: {
    feature: AnnotationFeature
    refName: string
  }) {
    const { feature } = props
    const name = getFeatureName(feature)
    const id = getFeatureId(feature)

    return (
      <Table
        size="small"
        sx={{ fontSize: '0.75rem', '& .MuiTableCell-root': { padding: '4px' } }}
      >
        <TableBody>
          {name !== '' && (
            <TableRow>
              <HeaderTableCell>Name</HeaderTableCell>
              <TableCell>{getFeatureName(feature)}</TableCell>
            </TableRow>
          )}
          {id !== '' && (
            <TableRow>
              <HeaderTableCell>ID</HeaderTableCell>
              <TableCell>{getFeatureId(feature)}</TableCell>
            </TableRow>
          )}
          <TableRow>
            <HeaderTableCell>Type</HeaderTableCell>
            <TableCell>{feature.type}</TableCell>
          </TableRow>
          <TableRow>
            <HeaderTableCell>Location</HeaderTableCell>
            <TableCell>
              {props.refName}:{feature.min}..{feature.max}
            </TableCell>
          </TableRow>
          <TableRow>
            <HeaderTableCell>Strand</HeaderTableCell>
            <TableCell>{getStrand(feature.strand)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
  },
)
