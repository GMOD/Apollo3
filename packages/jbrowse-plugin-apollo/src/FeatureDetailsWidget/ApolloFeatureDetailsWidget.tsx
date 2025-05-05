import { getSession } from '@jbrowse/core/util'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import React, { useEffect, useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { ApolloSessionModel } from '../session'

import { Attributes } from './Attributes'
import { BasicInformation } from './BasicInformation'
import { FeatureDetailsNavigation } from './FeatureDetailsNavigation'
import { Sequence } from './Sequence'
import { ApolloFeatureDetailsWidget as ApolloFeatureDetails } from './model'

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
            aria-controls="panel2-content"
            id="panel2-header"
          >
            <Typography component="span">Sequence</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {panelState.includes('sequence') && (
              <Sequence
                feature={feature}
                session={session}
                assembly={currentAssembly._id}
                refName={refName}
              />
            )}
          </AccordionDetails>
        </Accordion>
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
          </AccordionDetails>
        </Accordion>
      </div>
    )
  },
)
export default ApolloFeatureDetailsWidget
