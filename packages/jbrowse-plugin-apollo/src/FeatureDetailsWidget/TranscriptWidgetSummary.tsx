import React from 'react'

import { AnnotationFeature } from '@apollo-annotation/mst'
import { observer } from 'mobx-react'
import { getFeatureId, getFeatureName, getStrand } from '../util'
import { Table, TableBody, TableCell, TableRow } from '@mui/material'
import styled from '@emotion/styled'

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
