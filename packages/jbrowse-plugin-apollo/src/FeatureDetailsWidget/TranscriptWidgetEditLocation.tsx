/* eslint-disable unicorn/no-nested-ternary */
/* eslint-disable unicorn/prefer-at */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  type AnnotationFeature,
  type TranscriptPart,
} from '@apollo-annotation/mst'
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
  Grid2,
  Tooltip,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import React, { useRef } from 'react'

import { type OntologyRecord } from '../OntologyManager'
import { type ApolloSessionModel } from '../session'

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
      const sortedCDSLocations = firstCDSLocation.sort(
        ({ min: a }, { min: b }) => a - b,
      )
      cdsMin = sortedCDSLocations[0].min
      cdsMax = sortedCDSLocations[sortedCDSLocations.length - 1].max
    }

    function handleCDSLocationChange(
      oldLocation: number,
      newLocation: number,
      feature: AnnotationFeature,
      isMin: boolean,
      onComplete?: () => void,
    ) {
      if (!feature.children) {
        throw new Error('Transcript should have child features')
      }

      const overlappingExon = getOverlappingExonForCDS(
        feature,
        featureTypeOntology,
        oldLocation,
        isMin,
      )
      if (!overlappingExon) {
        notify('No matching exon found', 'error')
        return
      }
      const oldExonLocation = isMin ? overlappingExon.min : overlappingExon.max
      const { prevExon, nextExon } = getNeighboringExonParts(
        feature,
        featureTypeOntology,
        oldExonLocation,
        isMin,
      )

      // Start location should be less than end location
      if (isMin && newLocation >= overlappingExon.max) {
        notify(
          'Start location should be less than overlapping exon end location',
          'error',
        )
        return
      }

      // End location should be greater than start location
      if (!isMin && newLocation <= overlappingExon.min) {
        notify(
          'End location should be greater than overlapping exon start location',
          'error',
        )
        return
      }
      // Changed location should be greater than end location of previous exon - give 2bp buffer
      if (prevExon && prevExon.max + 2 > newLocation) {
        notify(
          'Start location should be greater than previous exon end location',
          'error',
        )
        return
      }
      // Changed location should be less than start location of next exon
      if (nextExon && nextExon.min - 2 < newLocation) {
        notify(
          'End location should be less than next exon start location',
          'error',
        )
        return
      }

      const cdsFeature = getMatchingCDSFeature(
        feature,
        featureTypeOntology,
        oldLocation,
        isMin,
      )

      if (!cdsFeature) {
        notify('No matching CDS feature found', 'error')
        return
      }

      if (!isMin && newLocation <= cdsFeature.min) {
        notify(
          'End location should be greater than CDS start location',
          'error',
        )
        return
      }
      if (isMin && newLocation >= cdsFeature.max) {
        notify('Start location should be less than CDS end location', 'error')
        return
      }

      const overlappingExonFeature = getExonFeature(
        feature,
        overlappingExon.min,
        overlappingExon.max,
        featureTypeOntology,
      )

      if (!overlappingExonFeature) {
        notify('No matching exon feature found', 'error')
        return
      }

      if (isMin && newLocation !== cdsFeature.min) {
        const startChange: LocationStartChange = new LocationStartChange({
          typeName: 'LocationStartChange',
          changedIds: [],
          changes: [],
          assembly,
        })

        if (newLocation < overlappingExon.min) {
          if (prevExon) {
            // update exon start location
            appendStartLocationChange(
              overlappingExonFeature,
              startChange,
              newLocation,
            )
            // update CDS start location
            appendStartLocationChange(cdsFeature, startChange, newLocation)
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
              appendStartLocationChange(
                overlappingExonFeature,
                startChange,
                newLocation,
              )
              // update CDS start location
              appendStartLocationChange(cdsFeature, startChange, newLocation)
            }
          }
        } else {
          // update CDS start location
          appendStartLocationChange(cdsFeature, startChange, newLocation)
        }

        void changeManager
          .submit(startChange)
          .then(() => {
            if (onComplete) {
              onComplete()
            }
          })
          .catch(() => {
            notify('Error updating feature CDS start position', 'error')
          })
      }

      if (!isMin && newLocation !== cdsFeature.max) {
        const endChange: LocationEndChange = new LocationEndChange({
          typeName: 'LocationEndChange',
          changedIds: [],
          changes: [],
          assembly,
        })

        if (newLocation > overlappingExon.max) {
          if (nextExon) {
            // update exon end location
            appendEndLocationChange(
              overlappingExonFeature,
              endChange,
              newLocation,
            )
            // update CDS end location
            appendEndLocationChange(cdsFeature, endChange, newLocation)
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
              appendEndLocationChange(
                overlappingExonFeature,
                endChange,
                newLocation,
              )
              // update CDS end location
              appendEndLocationChange(cdsFeature, endChange, newLocation)
            }
          }
        } else {
          // update CDS end location
          appendEndLocationChange(cdsFeature, endChange, newLocation)
        }

        void changeManager
          .submit(endChange)
          .then(() => {
            if (onComplete) {
              onComplete()
            }
          })
          .catch(() => {
            notify('Error updating feature CDS end position', 'error')
          })
      }
    }

    const updateCDSLocation = (
      oldLocation: number,
      newLocation: number,
      feature: AnnotationFeature,
      isMin: boolean,
    ) => {
      if (!feature.children) {
        throw new Error('Transcript should have child features')
      }
      if (oldLocation === newLocation) {
        return
      }

      const cdsFeature = getMatchingCDSFeature(
        feature,
        featureTypeOntology,
        oldLocation,
        isMin,
      )
      if (!cdsFeature) {
        notify('No matching CDS feature found', 'error')
        return
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

      void changeManager.submit(change).catch(() => {
        notify('Error updating feature CDS position', 'error')
      })
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
      const { matchingExon, prevExon, nextExon } = getNeighboringExonParts(
        feature,
        featureTypeOntology,
        oldLocation,
        isMin,
      )

      if (!matchingExon) {
        notify('No matching exon found', 'error')
        return
      }

      // Start location should be less than end location
      if (isMin && newLocation >= matchingExon.max) {
        notify(`Start location should be less than end location`, 'error')
        return
      }
      // End location should be greater than start location
      if (!isMin && newLocation <= matchingExon.min) {
        notify(`End location should be greater than start location`, 'error')
        return
      }
      // Changed location should be greater than end location of previous exon - give 2bp buffer
      if (prevExon && prevExon.max + 2 > newLocation) {
        notify(`Error while changing start location`, 'error')
        return
      }
      // Changed location should be less than start location of next exon - give 2bp buffer
      if (nextExon && nextExon.min - 2 < newLocation) {
        notify(`Error while changing end location`, 'error')
        return
      }

      const exonFeature = getExonFeature(
        feature,
        matchingExon.min,
        matchingExon.max,
        featureTypeOntology,
      )
      if (!exonFeature) {
        notify('No matching exon feature found', 'error')
        return
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

      // Suppose CDS locations are [{min: 0, max: 10}, {min: 20, max: 30}, {min: 40, max: 50}]
      // and codonGenomicPosition is 25
      // ((10 - 0) + (30 - 20) + (50 - 40)) > 25
      // So, start codon is in (40, 50)
      // 40 + (25-20) = 45 is the genomic location of the start codon
      if (strand === 1) {
        for (const loc of firstLocation) {
          const locLength = loc.max - loc.min
          if (cdsLen + locLength > codonGenomicPosition) {
            return loc.min + (codonGenomicPosition - cdsLen)
          }
          cdsLen += locLength
        }
      } else if (strand === -1) {
        for (let i = firstLocation.length - 1; i >= 0; i--) {
          const loc = firstLocation[i]
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
      const stopCodonIndex = translationSequence.indexOf('*') + 1

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
      const stopCodonGenomicLoc = getCodonGenomicLocation(
        stopCodonPos as unknown as number,
      )

      if (strand === 1) {
        let promise
        if (startCodonGenomicLoc !== cdsMin) {
          promise = new Promise((resolve) => {
            handleCDSLocationChange(
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
              handleCDSLocationChange(
                cdsMax,
                stopCodonGenomicLoc,
                feature,
                false,
              )
            })
          } else {
            handleCDSLocationChange(cdsMax, stopCodonGenomicLoc, feature, false)
          }
        }
      }

      if (strand === -1) {
        let promise
        if (startCodonGenomicLoc !== cdsMax) {
          promise = new Promise((resolve) => {
            handleCDSLocationChange(
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
              handleCDSLocationChange(
                cdsMin,
                stopCodonGenomicLoc,
                feature,
                true,
              )
            })
          } else {
            handleCDSLocationChange(cdsMin, stopCodonGenomicLoc, feature, true)
          }
        }
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
            <Grid2
              container
              justifyContent="center"
              alignItems="center"
              style={{ textAlign: 'center', marginTop: 10 }}
            >
              <Grid2 size={1} />
              <Grid2 size={4}>
                <StyledTextField
                  margin="dense"
                  variant="outlined"
                  value={cdsMin + 1}
                  onChangeCommitted={(newLocation: number) => {
                    handleCDSLocationChange(
                      cdsMin,
                      newLocation - 1,
                      feature,
                      true,
                    )
                  }}
                />
              </Grid2>
              <Grid2 size={2}>
                <Typography component={'span'}>CDS</Typography>
              </Grid2>
              <Grid2 size={4}>
                <StyledTextField
                  margin="dense"
                  variant="outlined"
                  value={cdsMax}
                  onChangeCommitted={(newLocation: number) => {
                    handleCDSLocationChange(cdsMax, newLocation, feature, false)
                  }}
                />
              </Grid2>
              <Grid2 size={1} />
            </Grid2>
          </div>
        )}
        <div style={{ marginTop: 5 }}>
          {transcriptExonParts.map((loc, index) => {
            return (
              <div key={index}>
                {loc.type === 'exon' && (
                  <Grid2
                    container
                    justifyContent="center"
                    alignItems="center"
                    style={{ textAlign: 'center' }}
                  >
                    <Grid2 size={1}>
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
                    </Grid2>
                    <Grid2 size={4} style={{ padding: 0 }}>
                      <StyledTextField
                        margin="dense"
                        variant="outlined"
                        value={loc.min + 1}
                        onChangeCommitted={(newLocation: number) => {
                          handleExonLocationChange(
                            loc.min,
                            newLocation - 1,
                            feature,
                            true,
                          )
                        }}
                      />
                    </Grid2>
                    <Grid2 size={2}>
                      <Strand strand={feature.strand} />
                    </Grid2>
                    <Grid2 size={4} style={{ padding: 0 }}>
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
                    </Grid2>
                    <Grid2 size={1}>
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
                    </Grid2>
                  </Grid2>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  },
)
