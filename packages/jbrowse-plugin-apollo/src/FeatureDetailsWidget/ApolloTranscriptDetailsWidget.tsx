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
  start: string
  oldStart: string
  end: string
  oldEnd: string
  startSeq: string
  endSeq: string
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
        Number(currentFeature.start) - 2,
        Number(currentFeature.start),
      )
      let endSeq = refData.getSequence(
        Number(currentFeature.end),
        Number(currentFeature.end) + 2,
      )

      if (currentFeature.strand === -1 && startSeq && endSeq) {
        startSeq = revcom(startSeq)
        endSeq = revcom(endSeq)
      }
      const oneCDS: CDSInfo = {
        id: currentFeature._id,
        type: currentFeature.type,
        strand: Number(currentFeature.strand),
        start: currentFeature.start + 1,
        end: currentFeature.end + 1,
        oldStart: currentFeature.start + 1,
        oldEnd: currentFeature.end + 1,
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
    return Number(a.start) - Number(b.start)
  })
  if (CDSresult.length > 0) {
    CDSresult[0].startSeq = ''

    // eslint-disable-next-line unicorn/prefer-at
    CDSresult[CDSresult.length - 1].endSeq = ''

    // Loop through the array and clear "startSeq" or "endSeq" based on the conditions
    for (let i = 0; i < CDSresult.length; i++) {
      if (i > 0 && CDSresult[i].start === CDSresult[i - 1].end) {
        // Clear "startSeq" if the current item's "start" is equal to the previous item's "end"
        CDSresult[i].startSeq = ''
      }
      if (
        i < CDSresult.length - 1 &&
        CDSresult[i].end === CDSresult[i + 1].start
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
    const internetAccount = useMemo(() => {
      return internetAccounts.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ia: any) => ia.type === 'ApolloInternetAccount',
      ) as ApolloInternetAccountModel | undefined
    }, [internetAccounts])
    const role = internetAccount ? internetAccount.getRole() : 'admin'
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
