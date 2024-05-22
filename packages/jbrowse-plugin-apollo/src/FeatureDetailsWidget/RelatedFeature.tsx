import {
  AnnotationFeature,
  AnnotationFeatureI,
} from '@apollo-annotation/apollo-mst'
import { SessionWithWidgets } from '@jbrowse/core/util'
import { Button, Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { IMSTMap } from 'mobx-state-tree'
import React from 'react'
import { makeStyles } from 'tss-react/mui'

import { ApolloSessionModel } from '../session'

const useStyles = makeStyles()((theme) => ({
  paper: {
    margin: theme.spacing(2),
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
  },
}))

export const RelatedFeatures = observer(function RelatedFeatures({
  assembly,
  feature,
  refName,
  session,
}: {
  feature: AnnotationFeatureI
  refName: string
  session: ApolloSessionModel
  assembly: string
}) {
  const { classes } = useStyles()
  const { parent } = feature
  const { children } = feature as {
    children?: IMSTMap<typeof AnnotationFeature>
  }

  const onButtonClick = (newFeature: AnnotationFeatureI) => {
    if (parent) {
      const apolloFeatureWidget = (
        session as unknown as SessionWithWidgets
      ).addWidget('ApolloFeatureDetailsWidget', 'apolloFeatureDetailsWidget', {
        feature: newFeature,
        assembly,
        refName,
      })
      ;(session as unknown as SessionWithWidgets).showWidget?.(
        apolloFeatureWidget,
      )
    }
  }

  if (!(parent || (children && children.size > 0))) {
    return null
  }
  return (
    <>
      <Typography variant="h4">Related features</Typography>
      {parent && (
        <>
          <Typography variant="h5">Parent</Typography>
          <Paper elevation={6} className={classes.paper}>
            {`Start: ${parent.start}, End: ${parent.end}, Type: ${parent.type}`}
            <Button variant="contained" onClick={() => onButtonClick(parent)}>
              Go to parent
            </Button>
          </Paper>
        </>
      )}
      {children && children.size > 0 && (
        <>
          <Typography variant="h5">Children</Typography>
          {[...children.values()].map((child) => (
            <Paper elevation={6} className={classes.paper} key={child._id}>
              {`Start: ${child.start}, End: ${child.end}, Type: ${child.type}`}
              <Button variant="contained" onClick={() => onButtonClick(child)}>
                Go to child
              </Button>
            </Paper>
          ))}
        </>
      )}
    </>
  )
})
