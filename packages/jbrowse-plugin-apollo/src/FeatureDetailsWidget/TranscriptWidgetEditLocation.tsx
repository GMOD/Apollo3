/* eslint-disable unicorn/no-nested-ternary */
/* eslint-disable unicorn/prefer-at */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import type { AnnotationFeature, TranscriptPart } from '@apollo-annotation/mst'
import {
  LocationEndChange,
  LocationStartChange,
} from '@apollo-annotation/shared'
import styled from '@emotion/styled'
import {
  type AbstractSessionModel,
  defaultCodonTable,
  revcom,
} from '@jbrowse/core/util'
import AddIcon from '@mui/icons-material/Add'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ContentCutIcon from '@mui/icons-material/ContentCut'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import RemoveIcon from '@mui/icons-material/Remove'
import {
  Accordion,
  AccordionDetails,
  Grid,
  Tooltip,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import React, { useRef } from 'react'

import type { OntologyRecord } from '../OntologyManager'
import type { ApolloSessionModel } from '../session'
import { copyToClipboard } from '../util/copyToClipboard'

import { StyledAccordionSummary } from './ApolloTranscriptDetailsWidget'
import { NumberTextField } from './NumberTextField'

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

const minMaxExonTranscriptLocation = (
  transcript: AnnotationFeature,
  featureTypeOntology: OntologyRecord,
) => {
  const { transcriptExonParts } = transcript
  const exonParts = transcriptExonParts
    .filter((part) => featureTypeOntology.isTypeOf(part.type, 'exon'))
    .sort(({ min: a }, { min: b }) => a - b)
  const exonMin: number = exonParts[0]?.min
  const exonMax: number = exonParts[exonParts.length - 1]?.max
  return [exonMin, exonMax]
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
    const { changeInProgress } = session

    if (!refData) {
      return null
    }

    const { apolloDataStore } = session
    const { featureTypeOntology } =
      apolloDataStore.ontologyManager as unknown as {
        featureTypeOntology: OntologyRecord
      }

    if (
      !featureTypeOntology.isTypeOf(feature.type, 'transcript') &&
      !featureTypeOntology.isTypeOf(feature.type, 'pseudogenic_transcript')
    ) {
      throw new Error('Feature is not a transcript or equivalent')
    }

    const { cdsLocations, transcriptExonParts, strand } = feature
    const [firstCDSLocation] = cdsLocations
    const [exonMin, exonMax] = minMaxExonTranscriptLocation(
      feature,
      featureTypeOntology,
    )
    let cdsMin = exonMin
    let cdsMax = exonMax
    const cdsPresent = firstCDSLocation.length > 0

    if (cdsPresent) {
      const sortedCDSLocations = firstCDSLocation.toSorted(
        ({ min: a }, { min: b }) => a - b,
      )
      cdsMin = sortedCDSLocations[0].min
      cdsMax = sortedCDSLocations[sortedCDSLocations.length - 1].max
    }

    const updateCDSLocation = (
      oldLocation: number,
      newLocation: number,
      feature: AnnotationFeature,
      isMin: boolean,
      onComplete?: () => void,
    ): boolean => {
      if (!feature.children) {
        throw new Error('Transcript should have child features')
      }
      if (oldLocation === newLocation) {
        return true
      }

      const cdsFeature = getMatchingCDSFeature(
        feature,
        featureTypeOntology,
        oldLocation,
        isMin,
      )
      if (!cdsFeature) {
        notify('No matching CDS feature found', 'error')
        return false
      }

      if (isMin && newLocation >= cdsFeature.max) {
        notify('Start location should be less than CDS end location', 'error')
        return false
      }

      if (!isMin && newLocation <= cdsFeature.min) {
        notify(
          'End location should be greater than CDS start location',
          'error',
        )
        return false
      }

      // overlapping exon of new CDS location
      const overlappingExon = getOverlappingExonForCDS(
        feature,
        featureTypeOntology,
        newLocation,
        isMin,
      )

      if (!overlappingExon) {
        notify(
          'There should be an overlapping exon for the new CDS location',
          'error',
        )
        return false
      }

      const change = isMin
        ? new LocationStartChange({
            typeName: 'LocationStartChange',
            changedIds: [cdsFeature._id],
            featureId: cdsFeature._id,
            oldStart: cdsFeature.min,
            newStart: newLocation,
            assembly,
          })
        : new LocationEndChange({
            typeName: 'LocationEndChange',
            changedIds: [cdsFeature._id],
            featureId: cdsFeature._id,
            oldEnd: cdsFeature.max,
            newEnd: newLocation,
            assembly,
          })

      void changeManager
        .submit(change)
        .then(() => {
          if (onComplete) {
            onComplete()
          }
        })
        .catch(() => {
          notify('Error updating feature CDS position', 'error')
        })
      return true
    }

    function handleExonLocationChange(
      oldLocation: number,
      newLocation: number,
      feature: AnnotationFeature,
      isMin: boolean,
    ): boolean {
      if (!feature.children) {
        throw new Error('Transcript should have child features')
      }
      const { matchingExon, prevExon, nextExon } = getNeighboringExonParts(
        feature,
        featureTypeOntology,
        oldLocation,
        isMin,
      )

      if (!matchingExon) {
        notify('No matching exon found', 'error')
        return false
      }

      // Start location should be less than end location
      if (isMin && newLocation >= matchingExon.max) {
        notify(`Start location should be less than end location`, 'error')
        return false
      }
      // End location should be greater than start location
      if (!isMin && newLocation <= matchingExon.min) {
        notify(`End location should be greater than start location`, 'error')
        return false
      }
      // Changed location should be greater than end location of previous exon - give 2bp buffer
      if (prevExon && prevExon.max + 2 > newLocation) {
        notify(`Error while changing start location`, 'error')
        return false
      }
      // Changed location should be less than start location of next exon - give 2bp buffer
      if (nextExon && nextExon.min - 2 < newLocation) {
        notify(`Error while changing end location`, 'error')
        return false
      }

      const exonFeature = getExonFeature(
        feature,
        matchingExon.min,
        matchingExon.max,
        featureTypeOntology,
      )
      if (!exonFeature) {
        notify('No matching exon feature found', 'error')
        return false
      }

      const cdsFeature = getFirstCDSFeature(feature, featureTypeOntology)

      // START LOCATION CHANGE
      if (isMin && newLocation !== matchingExon.min) {
        const startChange = new LocationStartChange({
          typeName: 'LocationStartChange',
          changedIds: [],
          changes: [],
          assembly,
        })
        if (prevExon) {
          // update exon start location
          appendStartLocationChange(exonFeature, startChange, newLocation)
        } else {
          const transcriptStart = feature.min
          const gene = feature.parent
          if (newLocation < transcriptStart) {
            if (gene && newLocation < gene.min) {
              // update gene start location
              appendStartLocationChange(gene, startChange, newLocation)
            }
            // update transcript start location
            appendStartLocationChange(feature, startChange, newLocation)
            // update exon start location
            appendStartLocationChange(exonFeature, startChange, newLocation)
          } else if (newLocation > transcriptStart) {
            // update exon start location
            appendStartLocationChange(exonFeature, startChange, newLocation)
            // update transcript start location
            appendStartLocationChange(feature, startChange, newLocation)

            if (gene) {
              const [geneMinWithNewLoc] = geneMinMaxWithNewLocation(
                gene,
                feature,
                newLocation,
                featureTypeOntology,
                isMin,
              )
              if (gene.min != geneMinWithNewLoc) {
                // update gene start location
                appendStartLocationChange(gene, startChange, geneMinWithNewLoc)
              }
            }
          }
        }

        // When we change the start location of the exon overlapping with start location of the CDS
        // and the new start location is greater than the CDS start location then we need to update the CDS start location
        if (
          cdsFeature &&
          cdsFeature.min >= matchingExon.min &&
          cdsFeature.min <= matchingExon.max &&
          newLocation > cdsFeature.min
        ) {
          // update CDS start location
          appendStartLocationChange(cdsFeature, startChange, newLocation)
        }

        void changeManager.submit(startChange).catch(() => {
          notify('Error updating feature exon start position', 'error')
        })
      }

      // END LOCATION CHANGE
      if (!isMin && newLocation !== matchingExon.max) {
        const endChange = new LocationEndChange({
          typeName: 'LocationEndChange',
          changedIds: [],
          changes: [],
          assembly,
        })
        if (nextExon) {
          // update exon end location
          appendEndLocationChange(exonFeature, endChange, newLocation)
        } else {
          const transcriptEnd = feature.max
          const gene = feature.parent
          if (newLocation > transcriptEnd) {
            if (gene && newLocation > gene.max) {
              // update gene end location
              appendEndLocationChange(gene, endChange, newLocation)
            }
            // update transcript end location
            appendEndLocationChange(feature, endChange, newLocation)
            // update exon end location
            appendEndLocationChange(exonFeature, endChange, newLocation)
          } else if (newLocation < transcriptEnd) {
            // update exon end location
            appendEndLocationChange(exonFeature, endChange, newLocation)
            // update transcript end location
            appendEndLocationChange(feature, endChange, newLocation)

            if (gene) {
              const [, geneMaxWithNewLoc] = geneMinMaxWithNewLocation(
                gene,
                feature,
                newLocation,
                featureTypeOntology,
                isMin,
              )
              if (gene.max != geneMaxWithNewLoc) {
                // update gene end location
                appendEndLocationChange(gene, endChange, geneMaxWithNewLoc)
              }
            }
          }
        }

        // When we change the end location of the exon overlapping with end location of the CDS
        // and the new end location is less than the CDS end location then we need to update the CDS end location
        if (
          cdsFeature &&
          cdsFeature.max >= matchingExon.min &&
          cdsFeature.max <= matchingExon.max &&
          newLocation < cdsFeature.max
        ) {
          // update CDS end location
          appendEndLocationChange(cdsFeature, endChange, newLocation)
        }

        void changeManager.submit(endChange).catch(() => {
          notify('Error updating feature exon end position', 'error')
        })
      }
      return true
    }

    const appendEndLocationChange = (
      feature: AnnotationFeature,
      change: LocationEndChange,
      newLocation: number,
    ) => {
      change.changedIds.push(feature._id)
      change.changes.push({
        featureId: feature._id,
        oldEnd: feature.max,
        newEnd: newLocation,
      })
    }

    const appendStartLocationChange = (
      feature: AnnotationFeature,
      change: LocationStartChange,
      newLocation: number,
    ) => {
      change.changedIds.push(feature._id)
      change.changes.push({
        featureId: feature._id,
        oldStart: feature.min,
        newStart: newLocation,
      })
    }

    const getMatchingCDSFeature = (
      feature: AnnotationFeature,
      featureTypeOntology: OntologyRecord,
      oldCDSLocation: number,
      isMin: boolean,
    ) => {
      let cdsFeature
      for (const [, child] of feature.children ?? []) {
        if (!featureTypeOntology.isTypeOf(child.type, 'CDS')) {
          continue
        }

        if (isMin && oldCDSLocation === child.min) {
          cdsFeature = child
          break
        }
        if (!isMin && oldCDSLocation === child.max) {
          cdsFeature = child
          break
        }
      }
      return cdsFeature
    }

    const getFirstCDSFeature = (
      feature: AnnotationFeature,
      featureTypeOntology: OntologyRecord,
    ) => {
      let cdsFeature
      for (const [, child] of feature.children ?? []) {
        if (!featureTypeOntology.isTypeOf(child.type, 'CDS')) {
          continue
        }
        cdsFeature = child
        break
      }
      return cdsFeature
    }

    const getExonFeature = (
      feature: AnnotationFeature,
      exonMin: number,
      exonMax: number,
      featureTypeOntology: OntologyRecord,
    ) => {
      let exonFeature
      for (const [, child] of feature.children ?? []) {
        if (!featureTypeOntology.isTypeOf(child.type, 'exon')) {
          continue
        }
        if (exonMin === child.min && exonMax === child.max) {
          exonFeature = child
          break
        }
      }
      return exonFeature
    }

    const geneMinMaxWithNewLocation = (
      gene: AnnotationFeature,
      transcript: AnnotationFeature,
      newLocation: number,
      featureTypeOntology: OntologyRecord,
      isMin: boolean,
    ) => {
      const mins = []
      const maxs = []
      for (const [, t] of gene.children?.entries() ?? []) {
        if (!featureTypeOntology.isTypeOf(t.type, 'transcript')) {
          continue
        }

        if (t._id === transcript._id) {
          if (isMin) {
            mins.push(newLocation)
            maxs.push(t.max)
          } else {
            maxs.push(newLocation)
            mins.push(t.min)
          }
        } else {
          mins.push(t.min)
          maxs.push(t.max)
        }
      }

      const newMin = Math.min(...mins)
      const newMax = Math.max(...maxs)
      return [newMin, newMax]
    }

    const getOverlappingExonForCDS = (
      transcript: AnnotationFeature,
      featureTypeOntology: OntologyRecord,
      oldCDSLocation: number,
      isMin: boolean,
    ) => {
      const { transcriptExonParts } = transcript
      let overlappingExonPart
      for (const [, exonPart] of transcriptExonParts.entries()) {
        if (!featureTypeOntology.isTypeOf(exonPart.type, 'exon')) {
          continue
        }
        if (
          !isMin &&
          oldCDSLocation >= exonPart.min &&
          oldCDSLocation <= exonPart.max
        ) {
          overlappingExonPart = exonPart
          break
        }
        if (
          isMin &&
          oldCDSLocation >= exonPart.min &&
          oldCDSLocation <= exonPart.max
        ) {
          overlappingExonPart = exonPart
          break
        }
      }
      return overlappingExonPart
    }

    const getNeighboringExonParts = (
      transcript: AnnotationFeature,
      featureTypeOntology: OntologyRecord,
      oldExonLoc: number,
      isMin: boolean,
    ) => {
      const { transcriptExonParts, strand } = transcript
      let matchingExon, matchingExonIdx, prevExon, nextExon
      for (const [i, exonPart] of transcriptExonParts.entries()) {
        if (!featureTypeOntology.isTypeOf(exonPart.type, 'exon')) {
          continue
        }
        if (isMin && exonPart.min === oldExonLoc) {
          matchingExon = exonPart
          matchingExonIdx = i
          break
        }
        if (!isMin && exonPart.max === oldExonLoc) {
          matchingExon = exonPart
          matchingExonIdx = i
          break
        }
      }

      if (matchingExon && matchingExonIdx !== undefined) {
        if (strand === 1 && matchingExonIdx > 0) {
          for (let i = matchingExonIdx - 1; i >= 0; i--) {
            const prevLoc = transcriptExonParts[i]
            if (featureTypeOntology.isTypeOf(prevLoc.type, 'exon')) {
              prevExon = prevLoc
              break
            }
          }
        }

        if (strand === -1 && matchingExonIdx < transcriptExonParts.length - 1) {
          for (
            let i = matchingExonIdx + 1;
            i < transcriptExonParts.length;
            i++
          ) {
            const prevLoc = transcriptExonParts[i]
            if (featureTypeOntology.isTypeOf(prevLoc.type, 'exon')) {
              prevExon = prevLoc
              break
            }
          }
        }

        if (strand === 1 && matchingExonIdx < transcriptExonParts.length - 1) {
          for (
            let i = matchingExonIdx + 1;
            i < transcriptExonParts.length;
            i++
          ) {
            const nextLoc = transcriptExonParts[i]
            if (featureTypeOntology.isTypeOf(nextLoc.type, 'exon')) {
              nextExon = nextLoc
              break
            }
          }
        }

        if (strand === -1 && matchingExonIdx > 0) {
          for (let i = matchingExonIdx - 1; i >= 0; i--) {
            const nextLoc = transcriptExonParts[i]
            if (featureTypeOntology.isTypeOf(nextLoc.type, 'exon')) {
              nextExon = nextLoc
              break
            }
          }
        }
      }
      return { matchingExon, prevExon, nextExon }
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
      spliceSite = spliceSite.toUpperCase()
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
      spliceSite = spliceSite.toUpperCase()
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
      const sortedCDSLocations = firstLocation.toSorted(
        ({ min: a }, { min: b }) => a - b,
      )
      for (const loc of sortedCDSLocations) {
        wholeSequence += refData.getSequence(loc.min, loc.max)
      }
      if (strand === -1) {
        // Original: ACGCAT
        // Complement: TGCGTA
        // Reverse complement: ATGCGT
        wholeSequence = revcom(wholeSequence)
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
                backgroundColor: changeInProgress ? 'lightgray' : 'yellow',
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
                if (startCodonGenomicLocation !== cdsMin && strand === 1) {
                  updateCDSLocation(
                    cdsMin,
                    startCodonGenomicLocation,
                    feature,
                    true,
                  )
                }
                if (startCodonGenomicLocation !== cdsMax && strand === -1) {
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

      // Trim any sequence before first start codon and after stop codon
      const startCodonIndex = translationSequence.indexOf('M')
      const stopCodonIndex = translationSequence.indexOf('*')

      const startCodonPos =
        translSeqCodonStartGenomicPosArr[startCodonIndex].codonGenomicPos
      const stopCodonPos =
        translSeqCodonStartGenomicPosArr[stopCodonIndex].codonGenomicPos

      if (!startCodonPos || !stopCodonPos) {
        return
      }
      const startCodonGenomicLoc = getCodonGenomicLocation(
        startCodonPos as unknown as number,
      )
      let stopCodonGenomicLoc = getCodonGenomicLocation(
        stopCodonPos as unknown as number,
      )

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
            updateCDSLocation(
              cdsMin,
              startCodonGenomicLoc,
              feature,
              true,
              () => {
                resolve(true)
              },
            )
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

    const onCopyClick = () => {
      const seqDiv = seqRef.current
      if (!seqDiv) {
        return
      }
      void copyToClipboard(seqDiv)
    }

    return (
      <div>
        {cdsPresent && (
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
            <Grid
              container
              justifyContent="center"
              alignItems="center"
              style={{ textAlign: 'center', marginTop: 10 }}
            >
              <Grid size={1} />
              {strand === 1 ? (
                <Grid size={4}>
                  <StyledTextField
                    margin="dense"
                    variant="outlined"
                    value={cdsMin + 1}
                    onChangeCommitted={(newLocation: number) => {
                      return updateCDSLocation(
                        cdsMin,
                        newLocation - 1,
                        feature,
                        true,
                      )
                    }}
                    style={{ border: '1px solid black', borderRadius: 5 }}
                    disabled={changeInProgress}
                  />
                </Grid>
              ) : (
                <Grid size={4}>
                  <StyledTextField
                    margin="dense"
                    variant="outlined"
                    value={cdsMax}
                    onChangeCommitted={(newLocation: number) => {
                      return updateCDSLocation(
                        cdsMax,
                        newLocation,
                        feature,
                        false,
                      )
                    }}
                    style={{ border: '1px solid black', borderRadius: 5 }}
                    disabled={changeInProgress}
                  />
                </Grid>
              )}
              <Grid size={2}>
                <Typography component={'span'}>CDS</Typography>
              </Grid>
              {strand === 1 ? (
                <Grid size={4}>
                  <StyledTextField
                    margin="dense"
                    variant="outlined"
                    value={cdsMax}
                    onChangeCommitted={(newLocation: number) => {
                      return updateCDSLocation(
                        cdsMax,
                        newLocation,
                        feature,
                        false,
                      )
                    }}
                    style={{ border: '1px solid black', borderRadius: 5 }}
                    disabled={changeInProgress}
                  />
                </Grid>
              ) : (
                <Grid size={4}>
                  <StyledTextField
                    margin="dense"
                    variant="outlined"
                    value={cdsMin + 1}
                    onChangeCommitted={(newLocation: number) => {
                      return updateCDSLocation(
                        cdsMin,
                        newLocation - 1,
                        feature,
                        true,
                      )
                    }}
                    style={{ border: '1px solid black', borderRadius: 5 }}
                    disabled={changeInProgress}
                  />
                </Grid>
              )}
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
                    {strand === 1 ? (
                      <Grid size={4} style={{ padding: 0 }}>
                        <StyledTextField
                          margin="dense"
                          variant="outlined"
                          value={loc.min + 1}
                          onChangeCommitted={(newLocation: number) => {
                            return handleExonLocationChange(
                              loc.min,
                              newLocation - 1,
                              feature,
                              true,
                            )
                          }}
                          disabled={changeInProgress}
                        />
                      </Grid>
                    ) : (
                      <Grid size={4} style={{ padding: 0 }}>
                        <StyledTextField
                          margin="dense"
                          variant="outlined"
                          value={loc.max}
                          onChangeCommitted={(newLocation: number) => {
                            return handleExonLocationChange(
                              loc.max,
                              newLocation,
                              feature,
                              false,
                            )
                          }}
                          disabled={changeInProgress}
                        />
                      </Grid>
                    )}
                    <Grid size={2}>
                      <Strand strand={feature.strand} />
                    </Grid>
                    {strand === 1 ? (
                      <Grid size={4} style={{ padding: 0 }}>
                        <StyledTextField
                          margin="dense"
                          variant="outlined"
                          value={loc.max}
                          onChangeCommitted={(newLocation: number) => {
                            return handleExonLocationChange(
                              loc.max,
                              newLocation,
                              feature,
                              false,
                            )
                          }}
                          disabled={changeInProgress}
                        />
                      </Grid>
                    ) : (
                      <Grid size={4} style={{ padding: 0 }}>
                        <StyledTextField
                          margin="dense"
                          variant="outlined"
                          value={loc.min + 1}
                          onChangeCommitted={(newLocation: number) => {
                            return handleExonLocationChange(
                              loc.min,
                              newLocation - 1,
                              feature,
                              true,
                            )
                          }}
                          disabled={changeInProgress}
                        />
                      </Grid>
                    )}
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
