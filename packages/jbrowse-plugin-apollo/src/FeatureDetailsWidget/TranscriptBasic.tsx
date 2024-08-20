import { AnnotationFeature } from '@apollo-annotation/mst'
import {
  LocationEndChange,
  LocationStartChange,
} from '@apollo-annotation/shared'
import { AbstractSessionModel, revcom } from '@jbrowse/core/util'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'
import React from 'react'

import { ApolloSessionModel } from '../session'
import { CDSInfo } from './TranscriptSequence'
import { NumberTextField } from './NumberTextField'

interface ExonInfo {
  min: number
  max: number
}

/**
 * Get single feature by featureId
 * @param feature -
 * @param featureId -
 * @returns
 */
function getFeatureFromId(
  feature: AnnotationFeature,
  featureId: string,
): AnnotationFeature | undefined {
  if (feature._id === featureId) {
    return feature
  }
  // Check if there is also childFeatures in parent feature and it's not empty
  // Let's get featureId from recursive method
  if (!feature.children) {
    return
  }
  for (const [, childFeature] of feature.children) {
    const subFeature = getFeatureFromId(childFeature, featureId)
    if (subFeature) {
      return subFeature
    }
  }
  return
}

function findExonInRange(
  exons: ExonInfo[],
  pairStart: number,
  pairEnd: number,
): ExonInfo | null {
  for (const exon of exons) {
    if (Number(exon.min) <= pairStart && Number(exon.max) >= pairEnd) {
      return exon
    }
  }
  return null
}

function removeMatchingExon(
  exons: ExonInfo[],
  matchStart: number,
  matchEnd: number,
): ExonInfo[] {
  // Filter the array to remove elements matching the specified start and end
  return exons.filter(
    (exon) => !(exon.min === matchStart && exon.max === matchEnd),
  )
}

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

    function handleStartChange(
      newStart: number,
      featureId: string,
      oldStart: number,
    ) {
      newStart--
      oldStart--
      if (newStart < feature.min) {
        notify('Feature start cannot be less than parent starts', 'error')
        return
      }
      const subFeature = getFeatureFromId(feature, featureId)
      if (!subFeature?.children) {
        return
      }
      // Let's check CDS start and end values. And possibly update those too
      for (const child of subFeature.children) {
        if (
          (child[1].type === 'CDS' || child[1].type === 'exon') &&
          child[1].min === oldStart
        ) {
          const change = new LocationStartChange({
            typeName: 'LocationStartChange',
            changedIds: [child[1]._id],
            featureId,
            oldStart,
            newStart,
            assembly,
          })
          changeManager.submit(change).catch(() => {
            notify('Error updating feature start position', 'error')
          })
        }
      }
      return
    }

    function handleEndChange(
      newEnd: number,
      featureId: string,
      oldEnd: number,
    ) {
      const subFeature = getFeatureFromId(feature, featureId)
      if (newEnd > feature.max) {
        notify('Feature start cannot be greater than parent end', 'error')
        return
      }
      if (!subFeature?.children) {
        return
      }
      // Let's check CDS start and end values. And possibly update those too
      for (const child of subFeature.children) {
        if (
          (child[1].type === 'CDS' || child[1].type === 'exon') &&
          child[1].max === oldEnd
        ) {
          const change = new LocationEndChange({
            typeName: 'LocationEndChange',
            changedIds: [child[1]._id],
            featureId,
            oldEnd,
            newEnd,
            assembly,
          })
          changeManager.submit(change).catch(() => {
            notify('Error updating feature end position', 'error')
          })
        }
      }
      return
    }

    const featureNew = feature
    let exonsArray: ExonInfo[] = []
    const traverse = (currentFeature: AnnotationFeature) => {
      if (currentFeature.type === 'exon') {
        exonsArray.push({
          min: currentFeature.min + 1,
          max: currentFeature.max,
        })
      }
      if (currentFeature.children) {
        for (const child of currentFeature.children) {
          traverse(child[1])
        }
      }
    }
    traverse(featureNew)

    const CDSresult: CDSInfo[] = []
    const CDSData = featureNew.cdsLocations
    if (refData) {
      for (const CDSDatum of CDSData) {
        for (const dataPoint of CDSDatum) {
          let startSeq = refData.getSequence(
            Number(dataPoint.min) - 2,
            Number(dataPoint.min),
          )
          let endSeq = refData.getSequence(
            Number(dataPoint.max),
            Number(dataPoint.max) + 2,
          )

          if (featureNew.strand === -1 && startSeq && endSeq) {
            startSeq = revcom(startSeq)
            endSeq = revcom(endSeq)
          }
          const oneCDS: CDSInfo = {
            id: featureNew._id,
            type: 'CDS',
            strand: Number(featureNew.strand),
            min: dataPoint.min + 1,
            max: dataPoint.max,
            oldMin: dataPoint.min + 1,
            oldMax: dataPoint.max,
            startSeq,
            endSeq,
          }
          // CDSresult.push(oneCDS)
          // Check if there is already an object with the same start and end
          const exists = CDSresult.some(
            (obj) =>
              obj.min === oneCDS.min &&
              obj.max === oneCDS.max &&
              obj.type === oneCDS.type,
          )

          // If no such object exists, add the new object to the array
          if (!exists) {
            CDSresult.push(oneCDS)
          }

          // Add possible UTRs
          const foundExon = findExonInRange(
            exonsArray,
            dataPoint.min + 1,
            dataPoint.max,
          )
          if (foundExon && Number(foundExon.min) < dataPoint.min) {
            if (feature.strand === 1) {
              const oneCDS: CDSInfo = {
                id: feature._id,
                type: 'five_prime_UTR',
                strand: Number(feature.strand),
                min: foundExon.min,
                max: dataPoint.min,
                oldMin: foundExon.min,
                oldMax: dataPoint.min,
                startSeq: '',
                endSeq: '',
              }
              CDSresult.push(oneCDS)
            } else {
              const oneCDS: CDSInfo = {
                id: feature._id,
                type: 'three_prime_UTR',
                strand: Number(feature.strand),
                min: dataPoint.min + 1,
                max: foundExon.min + 1,
                oldMin: dataPoint.min + 1,
                oldMax: foundExon.min + 1,
                startSeq: '',
                endSeq: '',
              }
              CDSresult.push(oneCDS)
            }
            exonsArray = removeMatchingExon(
              exonsArray,
              foundExon.min,
              foundExon.max,
            )
          }
          if (foundExon && Number(foundExon.max) > dataPoint.max) {
            if (feature.strand === 1) {
              const oneCDS: CDSInfo = {
                id: feature._id,
                type: 'three_prime_UTR',
                strand: Number(feature.strand),
                min: dataPoint.max + 1,
                max: foundExon.max,
                oldMin: dataPoint.max + 1,
                oldMax: foundExon.max,
                startSeq: '',
                endSeq: '',
              }
              CDSresult.push(oneCDS)
            } else {
              const oneCDS: CDSInfo = {
                id: feature._id,
                type: 'five_prime_UTR',
                strand: Number(feature.strand),
                min: dataPoint.min + 1,
                max: foundExon.max,
                oldMin: dataPoint.min + 1,
                oldMax: foundExon.max,
                startSeq: '',
                endSeq: '',
              }
              CDSresult.push(oneCDS)
            }
            exonsArray = removeMatchingExon(
              exonsArray,
              foundExon.min,
              foundExon.max,
            )
          }
          if (
            dataPoint.min + 1 === foundExon?.min &&
            dataPoint.max === foundExon.max
          ) {
            exonsArray = removeMatchingExon(
              exonsArray,
              foundExon.min,
              foundExon.max,
            )
          }
        }
      }
    }

    // Add remaining UTRs if any
    if (exonsArray.length > 0) {
      // eslint-disable-next-line unicorn/no-array-for-each
      exonsArray.forEach((element: ExonInfo) => {
        if (featureNew.strand === 1) {
          const oneCDS: CDSInfo = {
            id: featureNew._id,
            type: 'five_prime_UTR',
            strand: Number(featureNew.strand),
            min: element.min + 1,
            max: element.max,
            oldMin: element.min + 1,
            oldMax: element.max,
            startSeq: '',
            endSeq: '',
          }
          CDSresult.push(oneCDS)
        } else {
          const oneCDS: CDSInfo = {
            id: featureNew._id,
            type: 'three_prime_UTR',
            strand: Number(featureNew.strand),
            min: element.min + 1,
            max: element.max + 1,
            oldMin: element.min + 1,
            oldMax: element.max + 1,
            startSeq: '',
            endSeq: '',
          }
          CDSresult.push(oneCDS)
        }
        exonsArray = removeMatchingExon(exonsArray, element.min, element.max)
      })
    }

    CDSresult.sort((a, b) => {
      // Primary sorting by 'start' property
      const startDifference = Number(a.min) - Number(b.min)
      if (startDifference !== 0) {
        return startDifference
      }
      return Number(a.max) - Number(b.max)
    })
    if (CDSresult.length > 0) {
      CDSresult[0].startSeq = ''

      // eslint-disable-next-line unicorn/prefer-at
      CDSresult[CDSresult.length - 1].endSeq = ''

      // Loop through the array and clear "startSeq" or "endSeq" based on the conditions
      for (let i = 0; i < CDSresult.length; i++) {
        if (i > 0 && CDSresult[i].min === CDSresult[i - 1].max) {
          // Clear "startSeq" if the current item's "start" is equal to the previous item's "end"
          CDSresult[i].startSeq = ''
        }
        if (
          i < CDSresult.length - 1 &&
          CDSresult[i].max === CDSresult[i + 1].min
        ) {
          // Clear "endSeq" if the next item's "start" is equal to the current item's "end"
          CDSresult[i].endSeq = ''
        }
      }
    }

    const transcriptItems = CDSresult

    return (
      <>
        <Typography
          variant="h5"
          style={{ marginLeft: '15px', marginBottom: '0' }}
        >
          CDS and UTRs
        </Typography>
        <div>
          {transcriptItems.map((item, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ marginLeft: '20px', width: '50px' }}>
                {item.type === 'three_prime_UTR'
                  ? '3 UTR'
                  : // eslint-disable-next-line unicorn/no-nested-ternary
                    item.type === 'five_prime_UTR'
                    ? '5 UTR'
                    : 'CDS'}
              </span>
              <span style={{ fontWeight: 'bold', width: '30px' }}>
                {item.startSeq}
              </span>
              <NumberTextField
                margin="dense"
                id={item.id}
                disabled={item.type !== 'CDS'}
                style={{
                  width: '150px',
                  marginLeft: '8px',
                  backgroundColor:
                    item.startSeq.trim() === '' && index !== 0
                      ? 'lightblue'
                      : 'inherit',
                }}
                variant="outlined"
                value={item.min}
                onChangeCommitted={(newStart: number) => {
                  handleStartChange(newStart, item.id, Number(item.oldMin))
                }}
              />
              <span style={{ margin: '0 10px' }}>
                {/* eslint-disable-next-line unicorn/no-nested-ternary */}
                {item.strand === -1 ? '-' : item.strand === 1 ? '+' : ''}
              </span>
              <NumberTextField
                margin="dense"
                id={item.id}
                disabled={item.type !== 'CDS'}
                style={{
                  width: '150px',
                  backgroundColor:
                    item.endSeq.trim() === '' &&
                    index + 1 !== transcriptItems.length
                      ? 'lightblue'
                      : 'inherit',
                }}
                variant="outlined"
                value={item.max}
                onChangeCommitted={(newEnd: number) => {
                  handleEndChange(newEnd, item.id, Number(item.oldMax))
                }}
              />
              <span style={{ marginLeft: '8px', fontWeight: 'bold' }}>
                {item.endSeq}
              </span>
            </div>
          ))}
        </div>
      </>
    )
  },
)
