import { AbstractSessionModel, getSession, revcom } from '@jbrowse/core/util'
import { AnnotationFeatureNew } from 'apollo-mst'
import { observer } from 'mobx-react'
import { IAnyStateTreeNode, getRoot } from 'mobx-state-tree'
import React from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { ApolloSessionModel } from '../session'
import { ApolloRootModel } from '../types'
import { Attributes } from './Attributes'
import { TranscriptBasicInformation } from './TranscriptBasic'
import { TranscriptSequence } from './TranscriptSequence'

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

export const getCDSInfo = (
  feature: AnnotationFeatureNew,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refData: any,
): CDSInfo[] => {
  const CDSresult: CDSInfo[] = []
  const traverse = (
    currentFeature: AnnotationFeatureNew,
    isParentMRNA: boolean,
  ) => {
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
        min: (currentFeature.min + 1) as unknown as string,
        max: (currentFeature.max + 1) as unknown as string,
        oldMin: (currentFeature.min + 1) as unknown as string,
        oldMax: (currentFeature.max + 1) as unknown as string,
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

export const ApolloTranscriptDetailsWidget = observer(
  function ApolloTranscriptDetails(props: { model: IAnyStateTreeNode }) {
    const { model } = props
    const { assembly, feature, refName } = model
    const session = getSession(model) as unknown as AbstractSessionModel
    const apolloSession = getSession(model) as unknown as ApolloSessionModel
    const currentAssembly =
      apolloSession.apolloDataStore.assemblies.get(assembly)
    const { internetAccounts } = getRoot<ApolloRootModel>(session)

    const apolloInternetAccount = internetAccounts.find(
      (ia) => ia.type === 'ApolloInternetAccount',
    ) as ApolloInternetAccountModel | undefined
    const role = apolloInternetAccount ? apolloInternetAccount.role : 'admin'
    const editable = ['admin', 'user'].includes(role ?? '')

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
