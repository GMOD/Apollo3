/* eslint-disable @eslint-react/set-state-in-effect */
/* eslint-disable @eslint-react/static-components */
import styled from '@emotion/styled'
import { getEnv, getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getRoot } from '@jbrowse/mobx-state-tree'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import InfoIcon from '@mui/icons-material/Info'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Tooltip,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import React, { useEffect, useState } from 'react'

import type { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import type { ApolloSessionModel } from '../session'
import type { ApolloRootModel } from '../types'

import { Attributes } from './Attributes'
import { TranscriptSequence } from './TranscriptSequence'
import { TranscriptWidgetEditLocation } from './TranscriptWidgetEditLocation'
import { TranscriptWidgetSummary } from './TranscriptWidgetSummary'
import { getCustomComponent, getCustomComponentProps } from './customComponents'
import type { ApolloTranscriptDetailsWidget as ApolloTranscriptDetailsWidgetState } from './model'

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(2),
  },
}))

const StyledAccordionSummary = styled(AccordionSummary)(() => ({
  minHeight: 30,
  maxHeight: 30,
  '&.Mui-expanded': {
    minHeight: 30,
    maxHeight: 30,
  },
}))

export const ApolloTranscriptDetailsWidget = observer(
  function ApolloTranscriptDetails(props: {
    model: ApolloTranscriptDetailsWidgetState
  }) {
    const { classes } = useStyles()
    const DEFAULT_PANELS = ['summary', 'location']
    const [panelState, setPanelState] = useState<string[]>(DEFAULT_PANELS)

    const { model } = props
    const { assembly, feature, refName } = model

    useEffect(() => {
      setPanelState(DEFAULT_PANELS)
      // eslint-disable-next-line @eslint-react/exhaustive-deps
    }, [feature])

    const session = getSession(model)
    const { pluginManager } = getEnv(session)
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

    const customComponentProps = getCustomComponentProps({
      feature,
      session,
    })
    const CustomComponentInsideSummary = getCustomComponent(
      pluginManager,
      'Apollo-TranscriptDetailsCustomComponent-InsideSummary',
      customComponentProps,
    )

    const CustomComponentAfterSummary = getCustomComponent(
      pluginManager,
      'Apollo-TranscriptDetailsCustomComponent-AfterSummary',
      customComponentProps,
    )

    const CustomComponentInsideLocation = getCustomComponent(
      pluginManager,
      'Apollo-TranscriptDetailsCustomComponent-InsideLocation',
      customComponentProps,
    )

    const CustomComponentAfterLocation = getCustomComponent(
      pluginManager,
      'Apollo-TranscriptDetailsCustomComponent-AfterLocation',
      customComponentProps,
    )

    const CustomComponentInsideAttributes = getCustomComponent(
      pluginManager,
      'Apollo-TranscriptDetailsCustomComponent-InsideAttributes',
      customComponentProps,
    )

    const CustomComponentAfterAttributes = getCustomComponent(
      pluginManager,
      'Apollo-TranscriptDetailsCustomComponent-AfterAttributes',
      customComponentProps,
    )

    const CustomComponentInsideSequence = getCustomComponent(
      pluginManager,
      'Apollo-TranscriptDetailsCustomComponent-InsideSequence',
      customComponentProps,
    )

    const CustomComponentAfterSequence = getCustomComponent(
      pluginManager,
      'Apollo-TranscriptDetailsCustomComponent-AfterSequence',
      customComponentProps,
    )

    return (
      <div className={classes.root}>
        <Accordion
          expanded={panelState.includes('summary')}
          onChange={(e, expanded) => {
            handlePanelChange(expanded, 'summary')
          }}
        >
          <StyledAccordionSummary
            expandIcon={<ExpandMoreIcon style={{ color: 'white' }} />}
            aria-controls="panel1-content"
            id="panel1-header"
          >
            <Typography component="span" sx={{ fontWeight: 'bold' }}>
              Summary
            </Typography>
          </StyledAccordionSummary>
          <AccordionDetails>
            <TranscriptWidgetSummary feature={feature} refName={refName} />
            <CustomComponentInsideSummary {...customComponentProps} />
          </AccordionDetails>
        </Accordion>
        <CustomComponentAfterSummary {...customComponentProps} />
        <Accordion
          style={{ marginTop: 5 }}
          expanded={panelState.includes('location')}
          onChange={(e, expanded) => {
            handlePanelChange(expanded, 'location')
          }}
        >
          <StyledAccordionSummary
            expandIcon={<ExpandMoreIcon style={{ color: 'white' }} />}
            aria-controls="panel2-content"
            id="panel2-header"
          >
            <Typography component="span" sx={{ fontWeight: 'bold' }}>
              Location
            </Typography>
          </StyledAccordionSummary>
          <AccordionDetails>
            <TranscriptWidgetEditLocation
              feature={feature}
              refName={refName}
              session={apolloSession}
              assembly={currentAssembly._id || ''}
            />
            <CustomComponentInsideLocation {...customComponentProps} />
          </AccordionDetails>
        </Accordion>
        <CustomComponentAfterLocation {...customComponentProps} />
        <Accordion
          style={{ marginTop: 5 }}
          expanded={panelState.includes('attrs')}
          onChange={(e, expanded) => {
            handlePanelChange(expanded, 'attrs')
          }}
        >
          <StyledAccordionSummary
            expandIcon={<ExpandMoreIcon style={{ color: 'white' }} />}
            aria-controls="panel3-content"
            id="panel3-header"
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Typography component="span" sx={{ fontWeight: 'bold' }}>
                Attributes{' '}
              </Typography>
              <Tooltip title="Separate multiple values for the attribute with commas">
                <InfoIcon
                  style={{ color: 'white', fontSize: 15, marginLeft: 10 }}
                />
              </Tooltip>
            </div>
          </StyledAccordionSummary>
          <AccordionDetails>
            <Attributes
              feature={feature}
              session={apolloSession}
              assembly={currentAssembly._id || ''}
              editable={editable}
            />
            <CustomComponentInsideAttributes {...customComponentProps} />
          </AccordionDetails>
        </Accordion>
        <CustomComponentAfterAttributes {...customComponentProps} />
        <Accordion
          style={{ marginTop: 5 }}
          expanded={panelState.includes('sequence')}
          onChange={(e, expanded) => {
            handlePanelChange(expanded, 'sequence')
          }}
        >
          <StyledAccordionSummary
            expandIcon={<ExpandMoreIcon style={{ color: 'white' }} />}
            aria-controls="panel4-content"
            id="panel4-header"
          >
            <Typography component="span" sx={{ fontWeight: 'bold' }}>
              Sequence
            </Typography>
          </StyledAccordionSummary>
          <AccordionDetails>
            {panelState.includes('sequence') && (
              <TranscriptSequence
                feature={feature}
                session={apolloSession}
                assembly={currentAssembly._id || ''}
                refName={refName}
              />
            )}
            <CustomComponentInsideSequence {...customComponentProps} />
          </AccordionDetails>
        </Accordion>
        <CustomComponentAfterSequence {...customComponentProps} />
      </div>
    )
  },
)
export default ApolloTranscriptDetailsWidget
