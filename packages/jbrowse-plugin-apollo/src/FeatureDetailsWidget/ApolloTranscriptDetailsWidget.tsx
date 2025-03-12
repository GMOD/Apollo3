import { AbstractSessionModel, getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'
import { makeStyles } from 'tss-react/mui'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Tooltip,
  Typography,
} from '@mui/material'

import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import InfoIcon from '@mui/icons-material/Info'

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

    const [panelState, setPanelState] = useState<string[]>(['transcript'])

    const { model } = props
    const { assembly, feature, refName } = model

    useEffect(() => {
      setPanelState(['transcript'])
    }, [feature])

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

    function handlePanelChange(expanded: boolean, panel: string) {
      if (expanded) {
        setPanelState([...panelState, panel])
      } else {
        setPanelState(panelState.filter((p) => p !== panel))
      }
    }

    return (
      <div className={classes.root}>
        <Accordion
          expanded={panelState.includes('transcript')}
          onChange={(e, expanded) => {
            handlePanelChange(expanded, 'transcript')
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon style={{ color: 'white' }} />}
            aria-controls="panel1-content"
            id="panel1-header"
          >
            <Typography component="span">Transcript</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TranscriptBasicInformation
              feature={feature}
              session={apolloSession}
              assembly={currentAssembly._id || ''}
              refName={refName}
            />
          </AccordionDetails>
        </Accordion>
        <Accordion
          style={{ marginTop: 10 }}
          expanded={panelState.includes('attrs')}
          onChange={(e, expanded) => {
            handlePanelChange(expanded, 'attrs')
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon style={{ color: 'white' }} />}
            aria-controls="panel2-content"
            id="panel2-header"
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Typography component="span">Attributes </Typography>
              <Tooltip title="Separate multiple values for the attribute with commas">
                <InfoIcon
                  style={{ color: 'white', fontSize: 15, marginLeft: 10 }}
                />
              </Tooltip>
            </div>
          </AccordionSummary>
          <AccordionDetails>
            <Attributes
              feature={feature}
              session={apolloSession}
              assembly={currentAssembly._id || ''}
              editable={editable}
            />
          </AccordionDetails>
        </Accordion>
        <Accordion
          style={{ marginTop: 10 }}
          expanded={panelState.includes('sequence')}
          onChange={(e, expanded) => {
            handlePanelChange(expanded, 'sequence')
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon style={{ color: 'white' }} />}
            aria-controls="panel3-content"
            id="panel3-header"
          >
            <Typography component="span">Sequence</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {panelState.includes('sequence') && (
              <TranscriptSequence
                feature={feature}
                session={apolloSession}
                assembly={currentAssembly._id || ''}
                refName={refName}
              />
            )}
          </AccordionDetails>
        </Accordion>
      </div>
    )
  },
)
export default ApolloTranscriptDetailsWidget
