import { BaseInternetAccountModel } from '@jbrowse/core/pluggableElementTypes'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import React, { useMemo } from 'react'
import { makeStyles } from 'tss-react/mui'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { ApolloSessionModel } from '../session'
import { ApolloRootModel } from '../types'
import { Attributes } from './Attributes'
import { BasicInformation } from './BasicInformation'
import { ApolloFeatureDetailsWidget as ApolloFeatureDetails } from './model'
import { Sequence } from './Sequence'

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(2),
  },
}))

export const ApolloFeatureDetailsWidget = observer(
  function ApolloFeatureDetailsWidget(props: { model: ApolloFeatureDetails }) {
    const { model } = props
    const { assembly, feature, refName } = model
    const session = getSession(model) as unknown as ApolloSessionModel
    const currentAssembly = session.apolloDataStore.assemblies.get(assembly)
    const { classes } = useStyles()
    // const { internetAccounts } = getRoot<ApolloRootModel>(session)
    // const internetAccount = useMemo(() => {
    //   return internetAccounts.find(
    //     (ia: BaseInternetAccountModel) => ia.type === 'ApolloInternetAccount',
    //   ) as ApolloInternetAccountModel | undefined
    // }, [internetAccounts])
    // const role = internetAccount ? internetAccount.getRole() : 'admin'
    // const editable = ['admin', 'user'].includes(role ?? '')

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
      void session.apolloDataStore.loadRefSeq([
        { assemblyName: assembly, refName, start, end },
      ])
    }

    return (
      <div className={classes.root}>
        <BasicInformation
          feature={feature}
          session={session}
          assembly={currentAssembly._id}
        />
        <hr />
        <Attributes
          feature={feature}
          session={session}
          assembly={currentAssembly._id}
          // editable={editable}
          editable={true}
        />
        <hr />
        <Sequence
          feature={feature}
          session={session}
          assembly={currentAssembly._id}
          refName={refName}
        />
      </div>
    )
  },
)
export default ApolloFeatureDetailsWidget
