/* eslint-disable unicorn/no-nested-ternary */
/* eslint-disable unicorn/prefer-at */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import React, { useRef } from 'react'

import { observer } from 'mobx-react'

import styled from '@emotion/styled'
import {
  Accordion,
  AccordionDetails,
  Grid,
  Tooltip,
  Typography,
} from '@mui/material'

import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ContentCutIcon from '@mui/icons-material/ContentCut'

import { AnnotationFeature, TranscriptPart } from '@apollo-annotation/mst'

import { StyledAccordionSummary } from './ApolloTranscriptDetailsWidget'
import { NumberTextField } from './NumberTextField'
import { ApolloSessionModel } from '../session'
import {
  AbstractSessionModel,
  defaultCodonTable,
  revcom,
} from '@jbrowse/core/util'
import {
  LocationEndChange,
  LocationStartChange,
} from '@apollo-annotation/shared'

const StyledTextField = styled(NumberTextField)(() => ({
  '&.MuiFormControl-root': {
    marginTop: 0,
    marginBottom: 0,
    width: '100%',
  },
  '& .MuiInputBase-input': {
    fontSize: 12,
    height: 20,
    padding: 1,
    paddingLeft: 10,
  },
}))

const SequenceContainer = styled('div')({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  textAlign: 'left',
  width: '100%',
  overflowWrap: 'break-word',
  wordWrap: 'break-word',
  wordBreak: 'break-all',
  '& span': {
    fontSize: 12,
  },
})

const Strand = (props: { strand: 1 | -1 | undefined }) => {
  const { strand } = props

  return (
    <div>
      {strand === 1 ? (
        <AddIcon />
      ) : strand === -1 ? (
        <RemoveIcon />
      ) : (
        <Typography component={'span'}>N/A</Typography>
      )}
    </div>
  )
}

export const TranscriptWidgetEditLocation = observer(
  function TranscriptWidgetEditLocation({
    assembly,
    feature,
    refName,
    session,
  }: {
    feature: AnnotationFeature
    refName: string
    session: ApolloSessionModel
    assembly: string
  }) {
    const { notify } = session as unknown as AbstractSessionModel
    const currentAssembly = session.apolloDataStore.assemblies.get(assembly)
    const refData = currentAssembly?.getByRefName(refName)
    const { changeManager } = session.apolloDataStore
    const seqRef = useRef<HTMLDivElement>(null)

    // Separate function to handle CDS location change
    // because start of CDS and exon might be same
    function handleCDSLocationChange(
      oldLocation: number,
      newLocation: number,
      feature: AnnotationFeature,
      isMin: boolean,
    ) {
      if (!feature.children) {
        throw new Error('Transcript should have child features')
      }
      for (const [, child] of feature.children) {
        if (child.type !== 'CDS') {
          continue
        }
        if (isMin && oldLocation === child.min) {
          const change = new LocationStartChange({
            typeName: 'LocationStartChange',
            changedIds: [child._id],
            featureId: feature._id,
            oldStart: child.min,
            newStart: newLocation,
            assembly,
          })
          changeManager.submit(change).catch(() => {
            notify('Error updating feature start position', 'error')
          })
          return
        }
        if (!isMin && oldLocation === child.max) {
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

    function handleExonLocationChange(
      oldLocation: number,
      newLocation: number,
      feature: AnnotationFeature,
      isMin: boolean,
    ) {
      if (!feature.children) {
        throw new Error('Transcript should have child features')
      }
      for (const [, child] of feature.children) {
        if (child.type !== 'exon') {
          continue
        }
        if (isMin && oldLocation === child.min) {
          const change = new LocationStartChange({
            typeName: 'LocationStartChange',
            changedIds: [child._id],
            featureId: feature._id,
            oldStart: child.min,
            newStart: newLocation,
            assembly,
          })
          changeManager.submit(change).catch(() => {
            notify('Error updating feature start position', 'error')
          })
          return
        }
        if (!isMin && oldLocation === child.max) {
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

    const { cdsLocations, transcriptExonParts, strand } = feature
    const [firstCDSLocation] = cdsLocations

    const exonParts = transcriptExonParts
      .filter((part) => part.type === 'exon')
      .sort(({ min: a }, { min: b }) => a - b)

    const exonMin: number = exonParts[0]?.min
    const exonMax: number = exonParts[exonParts.length - 1]?.max

    let cdsMin = exonMin
    let cdsMax = exonMax
    const cdsPresent = firstCDSLocation.length > 0

    if (cdsPresent) {
      cdsMin = firstCDSLocation[0].min
      cdsMax = firstCDSLocation[firstCDSLocation.length - 1].max
    }

    const getFivePrimeSpliceSite = (
      loc: TranscriptPart,
      prevLocIdx: number,
    ) => {
      let spliceSite = ''
      if (prevLocIdx > 0) {
        const prevLoc = transcriptExonParts[prevLocIdx - 1]
        if (strand === 1) {
          if (prevLoc.type === 'intron') {
            spliceSite = refData.getSequence(loc.min - 2, loc.min)
          }
        } else {
          if (prevLoc.type === 'intron') {
            spliceSite = revcom(refData.getSequence(loc.max, loc.max + 2))
          }
        }
      }
      return [
        {
          spliceSite,
          color: spliceSite === 'AG' ? 'green' : 'red',
        },
      ]
    }

    const getThreePrimeSpliceSite = (
      loc: TranscriptPart,
      nextLocIdx: number,
    ) => {
      let spliceSite = ''
      if (nextLocIdx < transcriptExonParts.length - 1) {
        const nextLoc = transcriptExonParts[nextLocIdx + 1]
        if (strand === 1) {
          if (nextLoc.type === 'intron') {
            spliceSite = refData.getSequence(loc.max, loc.max + 2)
          }
        } else {
          if (nextLoc.type === 'intron') {
            spliceSite = revcom(refData.getSequence(loc.min - 2, loc.min))
          }
        }
      }
      return [
        {
          spliceSite,
          color: spliceSite === 'GT' ? 'green' : 'red',
        },
      ]
    }

    const getTranslationSequence = () => {
      let wholeSequence = ''
      const [firstLocation] = cdsLocations
      for (const loc of firstLocation) {
        let sequence = refData.getSequence(loc.min, loc.max)
        if (strand === -1) {
          sequence = revcom(sequence)
        }
        wholeSequence += sequence
      }
      const elements = []
      for (
        let codonGenomicPos = 0;
        codonGenomicPos < wholeSequence.length;
        codonGenomicPos += 3
      ) {
        const codonSeq = wholeSequence
          .slice(codonGenomicPos, codonGenomicPos + 3)
          .toUpperCase()
        const protein =
          defaultCodonTable[codonSeq as keyof typeof defaultCodonTable] || '&'
        // highlight start codon and stop codons
        if (codonSeq === 'ATG') {
          elements.push(
            <Typography
              component={'span'}
              style={{
                backgroundColor: 'yellow',
                cursor: 'pointer',
                border: '1px solid black',
              }}
              key={codonGenomicPos}
              onClick={() => {
                // NOTE: codonGenomicPos is important here for calculating the genomic location
                // of the start codon. We are using the codonGenomicPos as the key in the typography
                // elements to maintain the genomic postion of the codon start
                const startCodonGenomicLocation =
                  getStartCodonGenomicLocation(codonGenomicPos)
                if (startCodonGenomicLocation !== cdsMin) {
                  handleCDSLocationChange(
                    cdsMin,
                    startCodonGenomicLocation,
                    feature,
                    true,
                  )
                }
              }}
            >
              {protein}
            </Typography>,
          )
        } else if (['TAA', 'TAG', 'TGA'].includes(codonSeq)) {
          elements.push(
            <Typography
              style={{ backgroundColor: 'red', color: 'white' }}
              component={'span'}
              // Pass the codonGenomicPos as the key to maintain the genomic position of the codon
              key={codonGenomicPos}
            >
              {protein}
            </Typography>,
          )
        } else {
          elements.push(
            // Pass the codonGenomicPos as the key to maintain the genomic position of the codon
            <Typography component={'span'} key={codonGenomicPos}>
              {protein}
            </Typography>,
          )
        }
      }
      return elements
    }

    // Codon position is the index of the start codon in the CDS genomic sequence
    // Calculate the genomic location of the start codon based on the codon position in the CDS
    const getStartCodonGenomicLocation = (codonGenomicPosition: number) => {
      const [firstLocation] = cdsLocations
      let cdsLen = 0
      for (const loc of firstLocation) {
        const locLength = loc.max - loc.min
        // Suppose CDS locations are [{min: 0, max: 10}, {min: 20, max: 30}, {min: 40, max: 50}]
        // and codonGenomicPosition is 25
        // (((10 - 0) + (30 - 20)) + 10) > 25
        // 40 + (25-20) = 45 is the genomic location of the start codon
        if (cdsLen + locLength > codonGenomicPosition) {
          return loc.min + (codonGenomicPosition - cdsLen)
        }
        cdsLen += locLength
      }
      return cdsMin
    }

    const getStopCodonGenomicLocation = (codonGenomicPosition: number) => {
      const [firstLocation] = cdsLocations
      let cdsLen = 0
      for (const loc of firstLocation) {
        const locLength = loc.max - loc.min
        // Check if the codonPosition is within the current location
        if (cdsLen + locLength > codonGenomicPosition) {
          return loc.min + (codonGenomicPosition - cdsLen)
        }
        cdsLen += locLength
      }
      return cdsMax
    }

    const trimTranslationSequence = () => {
      const sequenceElements = getTranslationSequence()
      const translationSequence = sequenceElements
        .map((el) => el.props.children)
        .join('')

      if (
        translationSequence.startsWith('M') &&
        translationSequence.endsWith('*')
      ) {
        return
      }

      // NOTE: We are maintaining the genomic location of the codon start as the "key"
      // in typography elements. See getTranslationSequence function
      const translSeqCodonStartGenomicPosArr = []
      for (const el of sequenceElements) {
        translSeqCodonStartGenomicPosArr.push({
          codonGenomicPos: el.key,
          sequenceLetter: el.props.children,
        })
      }

      if (translSeqCodonStartGenomicPosArr.length === 0) {
        return
      }

      // Trim any sequence before first start codon and after last stop codon
      const startCodonIndex = translationSequence.indexOf('M')
      const stopCodonIndex = translationSequence.lastIndexOf('*') + 1
      const startCodonPos =
        translSeqCodonStartGenomicPosArr[startCodonIndex].codonGenomicPos
      const stopCodonPos =
        translSeqCodonStartGenomicPosArr[stopCodonIndex].codonGenomicPos

      if (!startCodonPos || !stopCodonPos) {
        return
      }

      const startCodonGenomicLoc = getStartCodonGenomicLocation(
        startCodonPos as unknown as number,
      )
      const stopCodonGenomicLoc = getStopCodonGenomicLocation(
        stopCodonPos as unknown as number,
      )

      if (startCodonGenomicLoc !== cdsMin) {
        handleCDSLocationChange(cdsMin, startCodonGenomicLoc, feature, true)
      }

      if (stopCodonGenomicLoc !== cdsMax) {
        // TODO: getting error when trying to change the CDS start and end location at the same time
        // Need to fix this
        setTimeout(() => {
          handleCDSLocationChange(cdsMax, stopCodonGenomicLoc, feature, false)
        }, 1000)
      }
    }

    const copyToClipboard = () => {
      const seqDiv = seqRef.current
      if (!seqDiv) {
        return
      }
      const textBlob = new Blob([seqDiv.outerText], { type: 'text/plain' })
      const htmlBlob = new Blob([seqDiv.outerHTML], { type: 'text/html' })
      const clipboardItem = new ClipboardItem({
        [textBlob.type]: textBlob,
        [htmlBlob.type]: htmlBlob,
      })
      void navigator.clipboard.write([clipboardItem])
    }

    return (
      <div>
        {cdsPresent && (
          <div>
            <Accordion defaultExpanded>
              <StyledAccordionSummary
                expandIcon={<ExpandMoreIcon style={{ color: 'white' }} />}
                aria-controls="panel1-content"
                id="panel1-header"
              >
                <Typography component="span" fontWeight={'bold'}>
                  Translation
                </Typography>
              </StyledAccordionSummary>
              <AccordionDetails>
                <SequenceContainer>
                  <Typography component={'span'} ref={seqRef}>
                    {getTranslationSequence()}
                  </Typography>
                </SequenceContainer>
                <div
                  style={{
                    marginTop: 10,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Tooltip title="Copy">
                    <ContentCopyIcon
                      style={{ fontSize: 15, cursor: 'pointer' }}
                      onClick={copyToClipboard}
                    />
                  </Tooltip>
                  <Tooltip title="Trim">
                    <ContentCutIcon
                      style={{ fontSize: 15, cursor: 'pointer' }}
                      onClick={trimTranslationSequence}
                    />
                  </Tooltip>
                </div>
              </AccordionDetails>
            </Accordion>
            <Grid
              container
              justifyContent="center"
              alignItems="center"
              style={{ textAlign: 'center', marginTop: 10 }}
            >
              <Grid size={1} />
              <Grid size={4}>
                <StyledTextField
                  margin="dense"
                  variant="outlined"
                  value={cdsMin}
                  onChangeCommitted={(newLocation: number) => {
                    handleCDSLocationChange(cdsMin, newLocation, feature, true)
                  }}
                />
              </Grid>
              <Grid size={2}>
                <Typography component={'span'}>CDS</Typography>
              </Grid>
              <Grid size={4}>
                <StyledTextField
                  margin="dense"
                  variant="outlined"
                  value={cdsMax}
                  onChangeCommitted={(newLocation: number) => {
                    handleCDSLocationChange(cdsMax, newLocation, feature, false)
                  }}
                />
              </Grid>
              <Grid size={1} />
            </Grid>
          </div>
        )}
        <div style={{ marginTop: 5 }}>
          {transcriptExonParts.map((loc, index) => {
            return (
              <div key={index}>
                {loc.type === 'exon' && (
                  <Grid
                    container
                    justifyContent="center"
                    alignItems="center"
                    style={{ textAlign: 'center' }}
                  >
                    <Grid size={1}>
                      {index !== 0 &&
                        getFivePrimeSpliceSite(loc, index).map((site, idx) => (
                          <Typography
                            key={idx}
                            component={'span'}
                            color={site.color}
                          >
                            {site.spliceSite}
                          </Typography>
                        ))}
                    </Grid>
                    <Grid size={4} style={{ padding: 0 }}>
                      <StyledTextField
                        margin="dense"
                        variant="outlined"
                        value={loc.min}
                        onChangeCommitted={(newLocation: number) => {
                          handleExonLocationChange(
                            loc.min,
                            newLocation,
                            feature,
                            true,
                          )
                        }}
                      />
                    </Grid>
                    <Grid size={2}>
                      <Strand strand={feature.strand} />
                    </Grid>
                    <Grid size={4} style={{ padding: 0 }}>
                      <StyledTextField
                        margin="dense"
                        variant="outlined"
                        value={loc.max}
                        onChangeCommitted={(newLocation: number) => {
                          handleExonLocationChange(
                            loc.max,
                            newLocation,
                            feature,
                            false,
                          )
                        }}
                      />
                    </Grid>
                    <Grid size={1}>
                      {index !== transcriptExonParts.length - 1 &&
                        getThreePrimeSpliceSite(loc, index).map((site, idx) => (
                          <Typography
                            key={idx}
                            component={'span'}
                            color={site.color}
                          >
                            {site.spliceSite}
                          </Typography>
                        ))}
                    </Grid>
                  </Grid>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  },
)
