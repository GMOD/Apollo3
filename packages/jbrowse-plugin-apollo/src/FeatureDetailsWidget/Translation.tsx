import type {
  AnnotationFeature,
  ApolloRefSeqI,
  TranscriptPartCoding,
} from '@apollo-annotation/mst'
import styled from '@emotion/styled'
import {
  type AbstractSessionModel,
  defaultCodonTable,
  revcom,
} from '@jbrowse/core/util'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ContentCutIcon from '@mui/icons-material/ContentCut'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Tooltip,
  Typography,
} from '@mui/material'
import React, { useRef } from 'react'

import type { ApolloSessionModel } from '../session'
import { copyToClipboard } from '../util/copyToClipboard'

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

const StyledAccordionSummary = styled(AccordionSummary)(() => ({
  minHeight: 30,
  maxHeight: 30,
  '&.Mui-expanded': {
    minHeight: 30,
    maxHeight: 30,
  },
}))

export function Translation({
  changeInProgress,
  cdsLocations,
  refData,
  strand,
  // eslint-disable-next-line @typescript-eslint/unbound-method
  updateCDSLocation,
  cdsMin,
  cdsMax,
  feature,
  session,
}: {
  changeInProgress: boolean
  cdsLocations: TranscriptPartCoding[][]
  refData: ApolloRefSeqI
  strand: 1 | -1 | undefined
  updateCDSLocation(
    oldLocation: number,
    newLocation: number,
    feature: AnnotationFeature,
    isMin: boolean,
    onComplete?: () => void,
  ): boolean
  cdsMin: number
  cdsMax: number
  feature: AnnotationFeature
  session: ApolloSessionModel
}) {
  const seqRef = useRef<HTMLDivElement>(null)
  const { notify } = session as unknown as AbstractSessionModel

  const cdsSequences: string[] = []
  const [firstLocation] = cdsLocations
  for (const loc of firstLocation) {
    const seq = refData.getSequence(loc.min, loc.max)
    cdsSequences.push(strand === -1 ? revcom(seq) : seq)
  }
  const cdsSequence = cdsSequences.join('')

  const proteinSequence: string[] = []
  for (
    let codonGenomicPos = 0;
    codonGenomicPos < cdsSequence.length;
    codonGenomicPos += 3
  ) {
    const codonSeq = cdsSequence
      .slice(codonGenomicPos, codonGenomicPos + 3)
      .toUpperCase()
    const protein =
      defaultCodonTable[codonSeq as keyof typeof defaultCodonTable] || '&'
    proteinSequence.push(protein)
  }

  const onCopyClick = () => {
    const seqDiv = seqRef.current
    if (!seqDiv) {
      return
    }
    void copyToClipboard(seqDiv)
  }

  // Codon position is the index of the start codon in the CDS genomic sequence
  // Calculate the genomic location of the start codon based on the codon position in the CDS
  const getCodonGenomicLocation = (codonGenomicPosition: number) => {
    const [firstLocation] = cdsLocations
    let cdsLen = 0
    const sortedCDSLocations = firstLocation.toSorted(
      ({ min: a }, { min: b }) => a - b,
    )

    // Suppose CDS locations are [{min: 0, max: 10}, {min: 20, max: 30}, {min: 40, max: 50}]
    // and codonGenomicPosition is 25
    // ((10 - 0) + (30 - 20) + (50 - 40)) > 25
    // So, start codon is in (40, 50)
    // 40 + (25-20) = 45 is the genomic location of the start codon
    if (strand === 1) {
      for (const loc of sortedCDSLocations) {
        const locLength = loc.max - loc.min
        if (cdsLen + locLength > codonGenomicPosition) {
          return loc.min + (codonGenomicPosition - cdsLen)
        }
        cdsLen += locLength
      }
    } else if (strand === -1) {
      for (let i = sortedCDSLocations.length - 1; i >= 0; i--) {
        const loc = sortedCDSLocations[i]
        const locLength = loc.max - loc.min
        if (cdsLen + locLength > codonGenomicPosition) {
          return loc.max - (codonGenomicPosition - cdsLen)
        }
        cdsLen += locLength
      }
    }

    if (strand === 1) {
      return cdsMin
    }

    return cdsMax
  }
  const trimTranslationSequence = () => {
    if (
      (proteinSequence.at(0) === 'M' && proteinSequence.at(-1) === '*') ||
      proteinSequence.length === 0
    ) {
      return
    }

    // Trim any sequence before first start codon and after stop codon
    const startCodonIndex = proteinSequence.indexOf('M')
    if (startCodonIndex === -1) {
      notify('Start codon not found', 'error')
      return
    }
    const stopCodonIndex = proteinSequence.indexOf('*', startCodonIndex)
    if (stopCodonIndex === -1) {
      notify('Stop codon not found', 'error')
      return
    }

    const startCodonPos = startCodonIndex * 3
    const stopCodonPos = stopCodonIndex * 3

    const startCodonGenomicLoc = getCodonGenomicLocation(startCodonPos)
    let stopCodonGenomicLoc = getCodonGenomicLocation(stopCodonPos)

    if (strand === 1) {
      if (startCodonGenomicLoc > stopCodonGenomicLoc) {
        notify(
          'Start codon genomic location should be less than stop codon genomic location',
          'error',
        )
        return
      }
      let promise
      stopCodonGenomicLoc += 3 // move to end of stop codon
      if (startCodonGenomicLoc !== cdsMin) {
        promise = new Promise((resolve) => {
          updateCDSLocation(cdsMin, startCodonGenomicLoc, feature, true, () => {
            resolve(true)
          })
        })
      }

      if (stopCodonGenomicLoc !== cdsMax) {
        if (promise) {
          void promise.then(() => {
            updateCDSLocation(cdsMax, stopCodonGenomicLoc, feature, false)
          })
        } else {
          updateCDSLocation(cdsMax, stopCodonGenomicLoc, feature, false)
        }
      }
    }

    if (strand === -1) {
      // reverse strand
      if (startCodonGenomicLoc < stopCodonGenomicLoc) {
        notify(
          'Start codon genomic location should be less than stop codon genomic location',
          'error',
        )
        return
      }
      let promise
      stopCodonGenomicLoc -= 3 // move to end of stop codon
      if (startCodonGenomicLoc !== cdsMax) {
        promise = new Promise((resolve) => {
          updateCDSLocation(
            cdsMax,
            startCodonGenomicLoc,
            feature,
            false,
            () => {
              resolve(true)
            },
          )
        })
      }

      if (stopCodonGenomicLoc !== cdsMin) {
        if (promise) {
          void promise.then(() => {
            updateCDSLocation(cdsMin, stopCodonGenomicLoc, feature, true)
          })
        } else {
          updateCDSLocation(cdsMin, stopCodonGenomicLoc, feature, true)
        }
      }
    }
    notify('Translation sequence trimmed to start and stop codons', 'success')
  }
  return (
    <div>
      <Accordion>
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
            <Typography
              component={'span'}
              ref={seqRef}
              style={{ maxHeight: 120, overflowY: 'scroll' }}
            >
              {proteinSequence.map((protein, idx) => {
                const codonGenomicPos = idx * 3
                if (protein === 'M') {
                  return (
                    <Typography
                      component={'span'}
                      style={{
                        backgroundColor: changeInProgress
                          ? 'lightgray'
                          : 'yellow',
                        cursor: 'pointer',
                        border: '1px solid black',
                      }}
                      key={codonGenomicPos}
                      onClick={() => {
                        if (changeInProgress) {
                          return
                        }
                        // NOTE: codonGenomicPos is important here for calculating the genomic location
                        // of the start codon. We are using the codonGenomicPos as the key in the typography
                        // elements to maintain the genomic postion of the codon start
                        const startCodonGenomicLocation =
                          getCodonGenomicLocation(codonGenomicPos)
                        if (
                          startCodonGenomicLocation !== cdsMin &&
                          strand === 1
                        ) {
                          updateCDSLocation(
                            cdsMin,
                            startCodonGenomicLocation,
                            feature,
                            true,
                          )
                        }
                        if (
                          startCodonGenomicLocation !== cdsMax &&
                          strand === -1
                        ) {
                          updateCDSLocation(
                            cdsMax,
                            startCodonGenomicLocation,
                            feature,
                            false,
                          )
                        }
                      }}
                    >
                      {protein}
                    </Typography>
                  )
                }

                if (protein === '*') {
                  return (
                    <Typography
                      style={{ backgroundColor: 'red', color: 'white' }}
                      component={'span'}
                      // Pass the codonGenomicPos as the key to maintain the genomic position of the codon
                      key={codonGenomicPos}
                    >
                      {protein}
                    </Typography>
                  )
                }
                // Pass the codonGenomicPos as the key to maintain the genomic position of the codon
                return (
                  <Typography component={'span'} key={codonGenomicPos}>
                    {protein}
                  </Typography>
                )
              })}
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
              <button
                onClick={onCopyClick}
                style={{ border: 'none', background: 'none', padding: 0 }}
                disabled={changeInProgress}
              >
                <ContentCopyIcon style={{ fontSize: 15 }} />
              </button>
            </Tooltip>
            <Tooltip title="Trim">
              <button
                onClick={trimTranslationSequence}
                style={{ border: 'none', background: 'none', padding: 0 }}
                disabled={changeInProgress}
              >
                <ContentCutIcon style={{ fontSize: 15 }} />
              </button>
            </Tooltip>
          </div>
        </AccordionDetails>
      </Accordion>
    </div>
  )
}
