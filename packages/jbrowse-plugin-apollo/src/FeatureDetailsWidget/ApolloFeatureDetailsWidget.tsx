import { BaseInternetAccountModel } from '@jbrowse/core/pluggableElementTypes'
import { getSession } from '@jbrowse/core/util'
import { Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import React, { useMemo, useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { ApolloSessionModel } from '../session'
import { ApolloRootModel } from '../types'
import { Attributes } from './Attributes'
import { BasicInformation } from './BasicInformation'
import { ApolloFeatureDetailsWidget as ApolloFeatureDetails } from './model'

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(2),
  },
}))

export interface AttributeValueEditorProps {
  session: ApolloSessionModel
  value: string[]
  onChange(newValue: string[]): void
}

export interface GOTerm {
  id: string
  label: string
}

export const ApolloFeatureDetailsWidget = observer(
  function ApolloFeatureDetailsWidget(props: { model: ApolloFeatureDetails }) {
    const { model } = props
    const { assembly, feature } = model
    const session = getSession(model) as unknown as ApolloSessionModel
    const currentAssembly = session.apolloDataStore.assemblies.get(assembly)
    const { classes } = useStyles()
    const [showSequence, setShowSequence] = useState(false)
    const { internetAccounts } = getRoot<ApolloRootModel>(session)
    const internetAccount = useMemo(() => {
      return internetAccounts.find(
        (ia: BaseInternetAccountModel) => ia.type === 'ApolloInternetAccount',
      ) as ApolloInternetAccountModel | undefined
    }, [internetAccounts])
    const role = internetAccount ? internetAccount.role : 'admin'
    const editable = ['admin', 'user'].includes(role ?? '')

    const handleSeqButtonClick = () => {
      setShowSequence(!showSequence)
    }

    if (!(feature && currentAssembly)) {
      return null
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
          editable={editable}
        />
        <hr />
        <Typography variant="h4">Sequence</Typography>
        <Button variant="contained" onClick={handleSeqButtonClick}>
          {showSequence ? 'Hide sequence' : 'Show sequence'}
        </Button>
        <div>
          {showSequence && (
            <textarea
              readOnly
              style={{
                marginLeft: '15px',
                height: '300px',
                width: '95%',
                resize: 'vertical',
                overflowY: 'scroll',
              }}
              value={''}
            />
          )}
        </div>
      </div>
    )
  },
)
export default ApolloFeatureDetailsWidget
