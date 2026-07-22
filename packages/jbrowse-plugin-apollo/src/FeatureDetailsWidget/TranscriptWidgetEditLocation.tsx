/* eslint-disable unicorn/no-nested-ternary */
/* eslint-disable unicorn/prefer-at */
import type { AnnotationFeature, TranscriptPart } from '@apollo-annotation/mst'
import {
  LocationEndChange,
  LocationStartChange,
} from '@apollo-annotation/shared'
import styled from '@emotion/styled'
import { type AbstractSessionModel, revcom } from '@jbrowse/core/util'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import { Grid, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { OntologyRecord } from '../OntologyManager'
import type { ApolloSessionModel } from '../session'

import { NumberTextField } from './NumberTextField'
import { Translation } from './Translation'

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

    return (
      <div>
        {cdsPresent && (
          <div>
            <Grid
              container
              sx={{ justifyContent: 'center', alignItems: 'center' }}
              style={{ textAlign: 'center' }}
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
        <div style={{ marginTop: 5, marginBottom: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <Typography>Exons</Typography>
          </div>
          {transcriptExonParts.map((loc, index) => {
            return (
              // eslint-disable-next-line @eslint-react/no-array-index-key
              <div key={index}>
                {loc.type === 'exon' && (
                  <Grid
                    container
                    sx={{ justifyContent: 'center', alignItems: 'center' }}
                    style={{ textAlign: 'center' }}
                  >
                    <Grid size={1}>
                      {index !== 0 &&
                        getFivePrimeSpliceSite(loc, index).map((site, idx) => (
                          <Typography
                            // eslint-disable-next-line @eslint-react/no-array-index-key
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
                            // eslint-disable-next-line @eslint-react/no-array-index-key
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
        {cdsPresent && (
          <Translation
            changeInProgress={changeInProgress}
            cdsLocations={cdsLocations}
            refData={refData}
            strand={strand}
            updateCDSLocation={updateCDSLocation}
            cdsMin={cdsMin}
            cdsMax={cdsMax}
            feature={feature}
            session={session}
          />
        )}
      </div>
    )
  },
)
