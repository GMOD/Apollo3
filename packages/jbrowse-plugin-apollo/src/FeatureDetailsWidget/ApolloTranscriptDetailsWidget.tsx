/* eslint-disable @typescript-eslint/no-explicit-any */
import { AbstractSessionModel, getSession, revcom } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { IAnyStateTreeNode, getRoot } from 'mobx-state-tree'
import React, { useMemo } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { ApolloSessionModel } from '../session'
import { ApolloRootModel } from '../types'
import { Attributes } from './Attributes'
import { TranscriptBasicInformation } from './TranscriptBasic'
import TranscriptSequence from './TranscriptSequence'

export interface CDSInfo {
  id: string
  type: string
  strand: number
  min: string
  oldMin: string
  max: string
  oldMax: string
  startSeq: string
  endSeq: string
}
export interface ExonInfo {
  min: string
  max: string
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getCDSInfo = (feature: any, refData: any): CDSInfo[] => {
  const CDSresult: CDSInfo[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traverse = (currentFeature: any, isParentMRNA: boolean) => {
    if (
      isParentMRNA &&
      (currentFeature.type === 'CDS' ||
        currentFeature.type === 'three_prime_UTR' ||
        currentFeature.type === 'five_prime_UTR')
    ) {
      let startSeq = refData.getSequence(
        Number(currentFeature.min) - 2,
        Number(currentFeature.min),
      )
      let endSeq = refData.getSequence(
        Number(currentFeature.max),
        Number(currentFeature.max) + 2,
      )

      if (currentFeature.strand === -1 && startSeq && endSeq) {
        startSeq = revcom(startSeq)
        endSeq = revcom(endSeq)
      }
      const oneCDS: CDSInfo = {
        id: currentFeature._id,
        type: currentFeature.type,
        strand: Number(currentFeature.strand),
        min: currentFeature.min + 1,
        max: currentFeature.max + 1,
        oldMin: currentFeature.min + 1,
        oldMax: currentFeature.max + 1,
        startSeq: startSeq ?? '',
        endSeq: endSeq ?? '',
      }
      CDSresult.push(oneCDS)
    }
    if (currentFeature.children) {
      for (const child of currentFeature.children) {
        traverse(child[1], feature.type === 'mRNA')
      }
    }
  }
  traverse(feature, feature.type === 'mRNA')
  CDSresult.sort((a, b) => {
    return Number(a.min) - Number(b.min)
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
  return CDSresult
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getCDSInfoWithoutUTRLines = (
  feature: any,
  refData: any,
): CDSInfo[] => {
  const CDSresult: CDSInfo[] = []
  let exonsArray: ExonInfo[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traverse = (currentFeature: any) => {
    if (currentFeature.type === 'exon') {
      exonsArray.push({ min: currentFeature.min, max: currentFeature.max })
    }
    if (currentFeature.type === 'CDS') {
      // Process only one CDS
      let startSeq = refData.getSequence(
        Number(currentFeature.min) - 2,
        Number(currentFeature.min),
      )
      let endSeq = refData.getSequence(
        Number(currentFeature.max),
        Number(currentFeature.max) + 2,
      )

      if (currentFeature.strand === -1 && startSeq && endSeq) {
        startSeq = revcom(startSeq)
        endSeq = revcom(endSeq)
      }
      const oneCDS: CDSInfo = {
        id: currentFeature._id,
        type: currentFeature.type,
        strand: Number(currentFeature.strand),
        min: currentFeature.min + 1,
        max: currentFeature.max + 1,
        oldMin: currentFeature.min + 1,
        oldMax: currentFeature.max + 1,
        startSeq: startSeq ?? '',
        endSeq: endSeq ?? '',
      }
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
        currentFeature.min,
        currentFeature.max,
      )
      if (foundExon && foundExon.min < currentFeature.min) {
        if (feature.strand === 1) {
          const oneCDS: CDSInfo = {
            id: feature._id,
            type: 'five_prime_UTR',
            strand: Number(feature.strand),
            min: foundExon.min + 1,
            max: currentFeature.min,
            oldMin: foundExon.min + 1,
            oldMax: currentFeature.min,
            startSeq: '',
            endSeq: '',
          }
          CDSresult.push(oneCDS)
        } else {
          const oneCDS: CDSInfo = {
            id: feature._id,
            type: 'three_prime_UTR',
            strand: Number(feature.strand),
            min: feature.min + 1,
            max: currentFeature.min + 1,
            oldMin: feature.min + 1,
            oldMax: currentFeature.min + 1,
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
      if (foundExon && foundExon.max > currentFeature.max) {
        if (feature.strand === 1) {
          const oneCDS: CDSInfo = {
            id: feature._id,
            type: 'three_prime_UTR',
            strand: Number(feature.strand),
            min: currentFeature.max + 1,
            max: foundExon.max,
            oldMin: currentFeature.max + 1,
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
            min: feature.min + 1,
            max: currentFeature.max,
            oldMin: feature.min + 1,
            oldMax: currentFeature.max,
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
        currentFeature.min === foundExon?.min &&
        currentFeature.max === foundExon?.max
      ) {
        exonsArray = removeMatchingExon(
          exonsArray,
          currentFeature.min,
          currentFeature.max,
        )
      }
    }
    if (currentFeature.children) {
      for (const child of currentFeature.children) {
        traverse(child[1])
      }
    }
  }
  traverse(feature)

  // Add remaining UTRs if any
  if (exonsArray.length > 0) {
    // eslint-disable-next-line unicorn/no-array-for-each
    exonsArray.forEach((element: ExonInfo) => {
      if (element.min === feature.min) {
        if (feature.strand === 1) {
          const oneCDS: CDSInfo = {
            id: feature._id,
            type: 'five_prime_UTR',
            strand: Number(feature.strand),
            min: feature.min + 1,
            max: element.max,
            oldMin: feature.min + 1,
            oldMax: element.max,
            startSeq: '',
            endSeq: '',
          }
          CDSresult.push(oneCDS)
        } else {
          const oneCDS: CDSInfo = {
            id: feature._id,
            type: 'three_prime_UTR',
            strand: Number(feature.strand),
            min: feature.min + 1,
            max: element.max + 1,
            oldMin: feature.min + 1,
            oldMax: element.max + 1,
            startSeq: '',
            endSeq: '',
          }
          CDSresult.push(oneCDS)
        }
      }
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
  return CDSresult
}

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

export const ApolloTranscriptDetailsWidget = observer(
  function ApolloTranscriptDetails(props: { model: IAnyStateTreeNode }) {
    const { model } = props
    const { assembly, feature, refName } = model
    const session = getSession(model) as unknown as AbstractSessionModel
    const apolloSession = getSession(model) as unknown as ApolloSessionModel
    const currentAssembly =
      apolloSession.apolloDataStore.assemblies.get(assembly)
    // const { internetAccounts } = getRoot<ApolloRootModel>(session)
    // const internetAccount = useMemo(() => {
    //   return internetAccounts.find(
    //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //     (ia: any) => ia.type === 'ApolloInternetAccount',
    //   ) as ApolloInternetAccountModel | undefined
    // }, [internetAccounts])
    // const role = internetAccount ? internetAccount.getRole() : 'admin'
    // const editable = ['admin', 'user'].includes(role ?? '')
    const editable = true

    if (!(feature && currentAssembly)) {
      return null
    }
    const refSeq = currentAssembly.getByRefName(refName)
    if (!refSeq) {
      return null
    }
    const { end, start } = feature

    const sequence = refSeq.getSequence(start, end)
    if (!sequence) {
      void apolloSession.apolloDataStore.loadRefSeq([
        { assemblyName: assembly, refName, start, end },
      ])
    }

    return (
      <>
        <TranscriptBasicInformation
          feature={feature}
          session={apolloSession}
          assembly={currentAssembly ? currentAssembly._id : ''}
          refName={refName}
        />
        <hr />
        <Attributes
          feature={feature}
          session={apolloSession}
          assembly={currentAssembly ? currentAssembly._id : ''}
          editable={editable}
        />
        <hr />
        <TranscriptSequence
          feature={feature}
          session={apolloSession}
          assembly={currentAssembly ? currentAssembly._id : ''}
          refName={refName}
        />
      </>
    )
  },
)
export default ApolloTranscriptDetailsWidget
