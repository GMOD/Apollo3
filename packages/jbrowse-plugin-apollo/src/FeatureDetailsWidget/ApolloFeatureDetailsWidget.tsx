import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import React from 'react'
import { makeStyles } from 'tss-react/mui'

import { ApolloSessionModel } from '../session'
import { Attributes } from './Attributes'
import { BasicInformation } from './BasicInformation'
import { ApolloFeatureDetailsWidget as ApolloFeatureDetails } from './model'
import { Sequence } from './Sequence'
import { FeatureDetailsNavigation } from './FeatureDetailsNavigation'

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
      void session.apolloDataStore.loadRefSeq([
        { assemblyName: assembly, refName, start: min, end: max },
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
          editable={true}
        />
        <hr />
        <Sequence
          feature={feature}
          session={session}
          assembly={currentAssembly._id}
          refName={refName}
        />
        <hr />
        <FeatureDetailsNavigation model={model} feature={feature} />
      </div>
    )
  },
)
export default ApolloFeatureDetailsWidget
