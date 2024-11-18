import { AnnotationFeature } from '@apollo-annotation/mst'
import {
  LocationEndChange,
  LocationStartChange,
} from '@apollo-annotation/shared'
import { AbstractSessionModel, getFrame, revcom } from '@jbrowse/core/util'
import {
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  useTheme,
} from '@mui/material'
import { observer } from 'mobx-react'
import React from 'react'

import { ApolloSessionModel } from '../session'
import { NumberTextField } from './NumberTextField'

export const TranscriptBasicInformation = observer(
  function TranscriptBasicInformation({
    assembly,
    feature,
    refName,
    session,
  }: {
    feature: AnnotationFeature
    session: ApolloSessionModel
    assembly: string
    refName: string
  }) {
    const { notify } = session as unknown as AbstractSessionModel
    const currentAssembly = session.apolloDataStore.assemblies.get(assembly)
    const refData = currentAssembly?.getByRefName(refName)
    const { changeManager } = session.apolloDataStore
    const theme = useTheme()

    function handleLocationChange(
      oldLocation: number,
      newLocation: number,
      feature: AnnotationFeature,
      isMin: boolean,
    ) {
      if (!feature.children) {
        throw new Error('Transcript should have child features')
      }
      for (const [, child] of feature.children) {
        if (isMin && oldLocation - 1 === child.min) {
          const change = new LocationStartChange({
            typeName: 'LocationStartChange',
            changedIds: [child._id],
            featureId: feature._id,
            oldStart: oldLocation - 1,
            newStart: newLocation - 1,
            assembly,
          })
          changeManager.submit(change).catch(() => {
            notify('Error updating feature start position', 'error')
          })
          return
        }
        if (!isMin && newLocation === child.max) {
          const change = new LocationEndChange({
            typeName: 'LocationEndChange',
            changedIds: [child._id],
            featureId: feature._id,
            oldEnd: child.max,
            newEnd: newLocation,
            assembly,
          })
          changeManager.submit(change).catch(() => {
            notify('Error updating feature start position', 'error')
          })
          return
        }
      }
    }

    if (!refData) {
      return null
    }

    const { strand, transcriptParts } = feature
    const [firstLocation] = transcriptParts

    const locationData = firstLocation
      .map((loc, idx) => {
        const { max, min, type } = loc
        let label: string = type
        if (label === 'threePrimeUTR') {
          label = '3` UTR'
        } else if (label === 'fivePrimeUTR') {
          label = '5` UTR'
        }
        let fivePrimeSpliceSite
        let threePrimeSpliceSite
        let frameColor
        if (type === 'CDS') {
          const { phase } = loc
          const frame = getFrame(min, max, strand ?? 1, phase)
          frameColor = theme.palette.framesCDS.at(frame)?.main
          const previousLoc = firstLocation.at(idx - 1)
          const nextLoc = firstLocation.at(idx + 1)
          if (strand === 1) {
            if (previousLoc?.type === 'intron') {
              fivePrimeSpliceSite = refData.getSequence(min - 2, min)
            }
            if (nextLoc?.type === 'intron') {
              threePrimeSpliceSite = refData.getSequence(max, max + 2)
            }
          } else {
            if (previousLoc?.type === 'intron') {
              fivePrimeSpliceSite = revcom(refData.getSequence(max, max + 2))
            }
            if (nextLoc?.type === 'intron') {
              threePrimeSpliceSite = revcom(refData.getSequence(min - 2, min))
            }
          }
        }
        return {
          min,
          max,
          label,
          fivePrimeSpliceSite,
          threePrimeSpliceSite,
          frameColor,
        }
      })
      .filter((loc) => loc.label !== 'intron')

    return (
      <>
        <Typography variant="h5">Structure</Typography>
        <Typography variant="h6">
          {strand === 1 ? 'Forward' : 'Reverse'} strand
        </Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableBody>
              {locationData.map((loc) => (
                <TableRow key={`${loc.label}:${loc.min}-${loc.max}`}>
                  <TableCell
                    component="th"
                    scope="row"
                    style={{ background: loc.frameColor }}
                  >
                    {loc.label}
                  </TableCell>
                  <TableCell>{loc.fivePrimeSpliceSite ?? ''}</TableCell>
                  <TableCell padding="none">
                    <NumberTextField
                      margin="dense"
                      variant="outlined"
                      value={strand === 1 ? loc.min + 1 : loc.max}
                      onChangeCommitted={(newLocation: number) => {
                        handleLocationChange(
                          strand === 1 ? loc.min + 1 : loc.max,
                          newLocation,
                          feature,
                          strand === 1,
                        )
                      }}
                    />
                    {/* {strand === 1 ? loc.min : loc.max} */}
                  </TableCell>
                  <TableCell padding="none">
                    <NumberTextField
                      margin="dense"
                      // disabled={item.type !== 'CDS'}
                      variant="outlined"
                      value={strand === 1 ? loc.max : loc.min + 1}
                      onChangeCommitted={(newLocation: number) => {
                        handleLocationChange(
                          strand === 1 ? loc.max : loc.min + 1,
                          newLocation,
                          feature,
                          strand !== 1,
                        )
                      }}
                    />
                    {/* {strand === 1 ? loc.max : loc.min} */}
                  </TableCell>
                  <TableCell>{loc.threePrimeSpliceSite ?? ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </>
    )
  },
)
