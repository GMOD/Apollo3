import { revcom } from '@jbrowse/core/util'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Typography } from '@mui/material'
import { AnnotationFeatureI, AnnotationFeatureNew } from 'apollo-mst'
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
  CDSInfo,
  ExonInfo,
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
  matchStart: string,
  matchEnd: string,
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
    feature: AnnotationFeatureI
    session: ApolloSessionModel
    assembly: string
    refName: string
  }) {
    const currentAssembly = session.apolloDataStore.assemblies.get(assembly)
    const refData = currentAssembly?.getByRefName(refName)
    const { changeManager } = session.apolloDataStore
    const fea = feature as unknown as AnnotationFeatureNew
    console.log(`******* FEA: ${JSON.stringify(fea.cdsLocations)}`)
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

    // ******** UUSI ALKAA ********
    console.log('*********** UUSI ALKAA **********')

    const featureNew = feature as unknown as AnnotationFeatureNew
    let exonsArray: ExonInfo[] = []
    const traverse = (currentFeature: AnnotationFeatureNew) => {
      if (currentFeature.type === 'exon') {
        console.log(
          `EXON DATA = ${currentFeature.min + 1} - ${currentFeature.max}`,
        )
        exonsArray.push({
          min: (currentFeature.min + 1) as unknown as string,
          max: currentFeature.max as unknown as string,
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
    console.log(`******* CDS data: ${JSON.stringify(CDSData)}`)
    if (refData) {
      for (const CDSDatum of CDSData) {
        for (const dataPoint of CDSDatum) {
          console.log(
            `CDS min: ${dataPoint.min}, max: ${dataPoint.max}, phase: ${dataPoint.phase}`,
          )
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
            min: (dataPoint.min + 1) as unknown as string,
            max: dataPoint.max as unknown as string,
            oldMin: (dataPoint.min + 1) as unknown as string,
            oldMax: dataPoint.max as unknown as string,
            startSeq: startSeq ?? '',
            endSeq: endSeq ?? '',
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
          console.log(`Exon array : ${JSON.stringify(exonsArray)}`)
          const foundExon = findExonInRange(
            exonsArray,
            dataPoint.min + 1,
            dataPoint.max,
          )
          console.log(
            foundExon
              ? `Found exon range: ${foundExon.min}-${foundExon.max}`
              : 'No range found.',
          )
          if (foundExon && Number(foundExon.min) < dataPoint.min) {
            if (feature.strand === 1) {
              console.log(
                `* TYPE = 5 UTR, start=${foundExon.min}, end=${Number(
                  dataPoint.min,
                )}`,
              )
              const oneCDS: CDSInfo = {
                id: feature._id,
                type: 'five_prime_UTR',
                strand: Number(feature.strand),
                min: foundExon.min,
                max: dataPoint.min as unknown as string,
                oldMin: foundExon.min,
                oldMax: dataPoint.min as unknown as string,
                startSeq: '',
                endSeq: '',
              }
              CDSresult.push(oneCDS)
            } else {
              console.log(
                `TYPE = 3 UTR, start=${dataPoint.min}, end=${
                  Number(featureNew.max) - 1
                }`,
              )
              const oneCDS: CDSInfo = {
                id: feature._id,
                type: 'three_prime_UTR',
                strand: Number(feature.strand),
                min: (dataPoint.min + 1) as unknown as string,
                max: foundExon.min + 1,
                oldMin: (dataPoint.min + 1) as unknown as string,
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
            console.log(
              `*** Need to add ending UTR: ${dataPoint.max} - ${foundExon.max}`,
            )
            if (feature.strand === 1) {
              console.log(
                `TYPE = 3 UTR, start=${dataPoint.max}, end=${
                  Number(foundExon.max) - 1
                }`,
              )
              const oneCDS: CDSInfo = {
                id: feature._id,
                type: 'three_prime_UTR',
                strand: Number(feature.strand),
                min: (dataPoint.max + 1) as unknown as string,
                max: foundExon.max,
                oldMin: (dataPoint.max + 1) as unknown as string,
                oldMax: foundExon.max,
                startSeq: '',
                endSeq: '',
              }
              CDSresult.push(oneCDS)
            } else {
              console.log(
                `** TYPE = 5 UTR, start=${dataPoint.min}, end=${Number(
                  foundExon.max,
                )}`,
              )
              const oneCDS: CDSInfo = {
                id: feature._id,
                type: 'five_prime_UTR',
                strand: Number(feature.strand),
                min: (dataPoint.min + 1) as unknown as string,
                max: foundExon.max,
                oldMin: (dataPoint.min + 1) as unknown as string,
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
            dataPoint.min + 1 === Number(foundExon?.min) &&
            dataPoint.max === Number(foundExon?.max)
          ) {
            console.log('******* CDS OLI KOKO EXONIN PITUINEN *****')
            exonsArray = removeMatchingExon(
              exonsArray,
              foundExon?.min as unknown as string,
              foundExon?.max as unknown as string,
            )
          }
        }
      }
    }
    console.log(`******* CDSresult: ${JSON.stringify(CDSresult)}`)
    console.log(`******* EXONEITA JALJELLA: ${exonsArray.length}`)
    console.log(`Exon array : ${JSON.stringify(exonsArray)}`)

    // Add remaining UTRs if any
    if (exonsArray.length > 0) {
      // eslint-disable-next-line unicorn/no-array-for-each
      exonsArray.forEach((element: ExonInfo) => {
        console.log(`Remaining EXON range ${element.min} - ${element.max}`)
        // if (element.min === (featureNew.min as unknown as string)) {
        if (featureNew.strand === 1) {
          console.log(
            `TYPE = 5 UTR, start=${element.min}, end=${Number(element.max)}`,
          )
          const oneCDS: CDSInfo = {
            id: featureNew._id,
            type: 'five_prime_UTR',
            strand: Number(featureNew.strand),
            min: (element.min + 1) as unknown as string,
            max: element.max,
            oldMin: (element.min + 1) as unknown as string,
            oldMax: element.max,
            startSeq: '',
            endSeq: '',
          }
          CDSresult.push(oneCDS)
        } else {
          console.log(
            `TYPE = 3 UTR, start=${element.min}, end=${
              Number(element.max) - 1
            }`,
          )
          const oneCDS: CDSInfo = {
            id: featureNew._id,
            type: 'three_prime_UTR',
            strand: Number(featureNew.strand),
            min: (element.min + 1) as unknown as string,
            max: element.max + 1,
            oldMin: (element.min + 1) as unknown as string,
            oldMax: element.max + 1,
            startSeq: '',
            endSeq: '',
          }
          CDSresult.push(oneCDS)
        }
        exonsArray = removeMatchingExon(exonsArray, element.min, element.max)
        // }
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
    console.log('*********** UUSI LOPPUU **********')

    const transcriptItems = CDSresult
    // const transcriptItemsOld = containsUTR(feature)
    //   ? getCDSInfo(feature, refData)
    //   : getCDSInfoWithoutUTRLines(feature, refData)
    // console.log(
    //   `******* transcriptItemsOld: ${JSON.stringify(transcriptItemsOld)}`,
    // )

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
