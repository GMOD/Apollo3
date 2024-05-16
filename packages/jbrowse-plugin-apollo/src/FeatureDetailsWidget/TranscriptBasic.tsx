/* eslint-disable @typescript-eslint/no-explicit-any */
import { Typography } from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import {
  DiscontinuousLocationEndChange,
  DiscontinuousLocationStartChange,
  LocationEndChange,
  LocationStartChange,
} from 'apollo-shared'
import { observer } from 'mobx-react'
import React from 'react'

import { ApolloSessionModel } from '../session'
import {
  getCDSInfo,
  getCDSInfoWithoutUTRLines,
} from './ApolloTranscriptDetailsWidget'
import { NumberTextField } from './NumberTextField'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const containsUTR = (currentFeature: any): boolean => {
  if (
    currentFeature.type === 'three_prime_UTR' ||
    currentFeature.type === 'five_prime_UTR'
  ) {
    return true
  }
  if (currentFeature.children) {
    for (const child of currentFeature.children) {
      if (containsUTR(child[1])) {
        return true
      }
    }
  }
  return false
}

/**
 * Get single feature by featureId
 * @param feature -
 * @param featureId -
 * @returns
 */
function getFeatureFromId(feature: any, featureId: string): any | null {
  if (feature._id === featureId) {
    return feature
  }
  // Check if there is also childFeatures in parent feature and it's not empty
  // Let's get featureId from recursive method
  for (const [, childFeature] of feature.children ?? new Map()) {
    const subFeature = getFeatureFromId(childFeature, featureId)
    if (subFeature) {
      return subFeature
    }
  }
  return null
}

export const TranscriptBasicInformation = observer(
  function TranscriptBasicInformation({
    assembly,
    feature,
    refName,
    session,
  }: {
    feature: AnnotationFeatureI
    session: ApolloSessionModel
    assembly: string
    refName: string
  }) {
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
      if (containsUTR(feature)) {
        const change = new LocationStartChange({
          typeName: 'LocationStartChange',
          changedIds: [featureId],
          featureId,
          oldStart,
          newStart,
          assembly,
        })
        return changeManager.submit(change)
      }
      const subFeature = getFeatureFromId(feature, featureId)
      console.log(`======= SUB FEATURE: ${JSON.stringify(subFeature)}`)
      console.log(
        `======= Parent feature type = ${feature.type} (${feature.start} - ${feature.end})`,
      )
      let exonChange
      if (feature.children) {
        // Let's check EXONs start and end values. And possibly update those too
        for (const child of feature.children) {
          if (child[1].type === 'exon') {
            // if (Number(child[1].start) <= oldStart && Number(child[1].end) >= subFeature.end && child[1].type === 'exon') {
            console.log(
              `======= Child type = '${child[1].type}', start = ${child[1].start}, end = ${child[1].end}`,
            )
            // eslint-disable-next-line @typescript-eslint/prefer-for-of
            for (let i = 0; i < subFeature.discontinuousLocations.length; i++) {
              if (
                Number(child[1].start) <=
                  subFeature.discontinuousLocations[i].start &&
                Number(child[1].end) >=
                  subFeature.discontinuousLocations[i].end &&
                subFeature.discontinuousLocations[i].start === oldStart &&
                Number(child[1].start) > newStart
              ) {
                console.log(
                  `+++++++ PITAA PAIVITTAA EXONI ALKAMAAN KOHDASTA  ${newStart}. Exonin ID = ${child[1]._id}`,
                )
                exonChange = new LocationStartChange({
                  typeName: 'LocationStartChange',
                  changedIds: [child[1]._id],
                  featureId: child[1]._id,
                  oldStart: child[1].start,
                  newStart,
                  assembly,
                })
              }
              // if (subFeature.discontinuousLocations[i].start === oldStart) {
              //   console.log(
              //     `++ Lets update start by index ${ind}, oldStart=${oldStart}, newStart=${newStart}`,
              //   )
              //   break
              // }
            }
          }
        }
      }
      let ind = 0
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < subFeature.discontinuousLocations.length; i++) {
        if (subFeature.discontinuousLocations[i].start === oldStart) {
          console.log(
            `++ Lets update start by index ${ind}, oldStart=${oldStart}, newStart=${newStart}`,
          )
          break
        }
        ind++
      }
      const change = new DiscontinuousLocationStartChange({
        typeName: 'DiscontinuousLocationStartChange',
        changedIds: [featureId],
        featureId,
        oldStart,
        newStart,
        assembly,
        index: ind,
      })
      if (exonChange) {
        console.log('============ Lets update exon start')
        void changeManager.submit(exonChange)
        console.log('============ Exon start updated')
      }
      console.log('============ Lets update CDS start')
      return changeManager.submit(change)
    }

    function handleEndChange(
      newEnd: number,
      featureId: string,
      oldEnd: number,
    ) {
      newEnd--
      // oldEnd--
      if (containsUTR(feature)) {
        const change = new LocationEndChange({
          typeName: 'LocationEndChange',
          changedIds: [featureId],
          featureId,
          oldEnd,
          newEnd,
          assembly,
        })
        return changeManager.submit(change)
      }
      const subFeature = getFeatureFromId(feature, featureId)
      // console.log(`======= SUB FEATURE: ${JSON.stringify(subFeature)}`)
      let ind = 0
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < subFeature.discontinuousLocations.length; i++) {
        if (subFeature.discontinuousLocations[i].end === oldEnd) {
          // console.log(`++ Lets update end by index ${ind}`)
          break
        }
        ind++
      }
      const change = new DiscontinuousLocationEndChange({
        typeName: 'DiscontinuousLocationEndChange',
        changedIds: [featureId],
        featureId,
        oldEnd,
        newEnd,
        assembly,
        index: ind,
      })
      return changeManager.submit(change)
    }

    const transcriptItems = containsUTR(feature)
      ? getCDSInfo(feature, refData)
      : getCDSInfoWithoutUTRLines(feature, refData)

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
                  : item.type === 'five_prime_UTR'
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
                onChangeCommitted={(newStart: number) =>
                  handleStartChange(newStart, item.id, Number(item.oldMin))
                }
              />
              <span style={{ margin: '0 10px' }}>
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
                onChangeCommitted={(newEnd: number) =>
                  handleEndChange(newEnd, item.id, Number(item.oldMax))
                }
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
