// Custom components come from plugins through extension points; they're
// defined by the plugins, not created during render
/* eslint-disable @eslint-react/static-components */
import {
  type AbstractSessionModel,
  getEnv,
  getSession,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import React, { useEffect, useState } from 'react'

import type { ApolloSessionModel } from '../session'

import { Attributes } from './Attributes'
import { BasicInformation } from './BasicInformation'
import { FeatureDetailsNavigation } from './FeatureDetailsNavigation'
import { SequenceViewer } from './SequenceViewer'
import { getCustomComponent } from './customComponents'
import type { ApolloFeatureDetailsWidget as ApolloFeatureDetails } from './model'
import { type SequenceSegment, getLocationIntervals } from './sequenceSegments'

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

    const [panelState, setPanelState] = useState<string[]>(['attributes'])

    useEffect(() => {
      // eslint-disable-next-line @eslint-react/set-state-in-effect
      setPanelState(['attributes'])
    }, [feature])

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
    const sequenceSegments: SequenceSegment[] = sequence
      ? [{ type: 'plain', sequence, locs: [{ min, max }] }]
      : []
    const locationIntervals = getLocationIntervals(sequenceSegments)

    const { pluginManager } = getEnv(session)
    const customComponentProps = {
      feature,
      session: session as unknown as AbstractSessionModel,
    }
    const CustomComponentAfterBasicInformation = getCustomComponent(
      pluginManager,
      'Apollo-FeatureDetailsCustomComponent-AfterBasicInformation',
      customComponentProps,
    )
    const CustomComponentInsideAttributes = getCustomComponent(
      pluginManager,
      'Apollo-FeatureDetailsCustomComponent-InsideAttributes',
      customComponentProps,
    )
    const CustomComponentAfterAttributes = getCustomComponent(
      pluginManager,
      'Apollo-FeatureDetailsCustomComponent-AfterAttributes',
      customComponentProps,
    )
    const CustomComponentInsideSequence = getCustomComponent(
      pluginManager,
      'Apollo-FeatureDetailsCustomComponent-InsideSequence',
      customComponentProps,
    )
    const CustomComponentAfterSequence = getCustomComponent(
      pluginManager,
      'Apollo-FeatureDetailsCustomComponent-AfterSequence',
      customComponentProps,
    )
    const CustomComponentInsideRelatedFeatures = getCustomComponent(
      pluginManager,
      'Apollo-FeatureDetailsCustomComponent-InsideRelatedFeatures',
      customComponentProps,
    )
    const CustomComponentAfterRelatedFeatures = getCustomComponent(
      pluginManager,
      'Apollo-FeatureDetailsCustomComponent-AfterRelatedFeatures',
      customComponentProps,
    )

    function handlePanelChange(expanded: boolean, panel: string) {
      if (expanded) {
        setPanelState([...panelState, panel])
      } else {
        setPanelState(panelState.filter((p) => p !== panel))
      }
    }

    return (
      <div className={classes.root}>
        <BasicInformation
          feature={feature}
          session={session}
          assembly={currentAssembly._id}
        />
        <CustomComponentAfterBasicInformation {...customComponentProps} />
        <Accordion
          style={{ marginTop: 10 }}
          expanded={panelState.includes('attributes')}
          onChange={(e, expanded) => {
            handlePanelChange(expanded, 'attributes')
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon style={{ color: 'white' }} />}
            aria-controls="panel1-content"
            id="panel1-header"
          >
            <Typography component="span">Attributes</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Attributes
              feature={feature}
              session={session}
              assembly={currentAssembly._id}
              editable={true}
            />
            <CustomComponentInsideAttributes {...customComponentProps} />
          </AccordionDetails>
        </Accordion>
        <CustomComponentAfterAttributes {...customComponentProps} />
        <Accordion
          style={{ marginTop: 10 }}
          expanded={panelState.includes('sequence')}
          onChange={(e, expanded) => {
            handlePanelChange(expanded, 'sequence')
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon style={{ color: 'white' }} />}
            aria-controls="panel2-content"
            id="panel2-header"
          >
            <Typography component="span">Sequence</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {panelState.includes('sequence') && sequence && (
              <SequenceViewer
                refSeqName={refName}
                strand={feature.strand === -1 ? -1 : 1}
                locationIntervals={locationIntervals}
                sequenceSegments={sequenceSegments}
              />
            )}
            <CustomComponentInsideSequence {...customComponentProps} />
          </AccordionDetails>
        </Accordion>
        <CustomComponentAfterSequence {...customComponentProps} />
        <Accordion
          style={{ marginTop: 10 }}
          expanded={panelState.includes('related_features')}
          onChange={(e, expanded) => {
            handlePanelChange(expanded, 'related_features')
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon style={{ color: 'white' }} />}
            aria-controls="panel3-content"
            id="panel3-header"
          >
            <Typography component="span">Related features</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <FeatureDetailsNavigation model={model} feature={feature} />
            <CustomComponentInsideRelatedFeatures {...customComponentProps} />
          </AccordionDetails>
        </Accordion>
        <CustomComponentAfterRelatedFeatures {...customComponentProps} />
      </div>
    )
  },
)
export default ApolloFeatureDetailsWidget
