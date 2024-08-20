import { AbstractSessionModel, getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import React from 'react'
import { makeStyles } from 'tss-react/mui'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { ApolloSessionModel } from '../session'
import { ApolloRootModel } from '../types'
import { Attributes } from './Attributes'
import { TranscriptBasicInformation } from './TranscriptBasic'
import { TranscriptSequence } from './TranscriptSequence'
import { ApolloTranscriptDetailsWidget as ApolloTranscriptDetailsWidgetState } from './model'

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(2),
  },
}))

export const ApolloTranscriptDetailsWidget = observer(
  function ApolloTranscriptDetails(props: {
    model: ApolloTranscriptDetailsWidgetState
  }) {
    const { classes } = useStyles()
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
    const { max, min } = feature

    const sequence = refSeq.getSequence(min, max)
    if (!sequence) {
      void apolloSession.apolloDataStore.loadRefSeq([
        { assemblyName: assembly, refName, start: min, end: max },
      ])
    }

    return (
      <div className={classes.root}>
        <TranscriptBasicInformation
          feature={feature}
          session={apolloSession}
          assembly={currentAssembly._id || ''}
          refName={refName}
        />
        <hr />
        <Attributes
          feature={feature}
          session={apolloSession}
          assembly={currentAssembly._id || ''}
          editable={editable}
        />
        <hr />
        <TranscriptSequence
          feature={feature}
          session={apolloSession}
          assembly={currentAssembly._id || ''}
          refName={refName}
        />
      </div>
    )
  },
)
export default ApolloTranscriptDetailsWidget
