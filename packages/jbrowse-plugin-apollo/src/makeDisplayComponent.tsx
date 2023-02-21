import PluginManager from '@jbrowse/core/PluginManager'
import type LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'
import { alpha } from '@mui/material/styles'
import { observer } from 'mobx-react'
import React from 'react'
import { makeStyles } from 'tss-react/mui'

import { ApolloDetails } from './LinearApolloDisplay/components'
import { LinearApolloDisplay } from './LinearApolloDisplay/stateModel'
import { TrackLines } from './SixFrameFeatureDisplay/components'
import { SixFrameFeatureDisplay } from './SixFrameFeatureDisplay/stateModel'

const useStyles = makeStyles()((theme) => ({
  shading: {
    background: alpha(theme.palette.primary.main, 0.2),
    overflowY: 'scroll',
    overflowX: 'hidden',
  },
  details: {
    background: theme.palette.background.paper,
  },
}))

export function makeDisplayComponent(pluginManager: PluginManager) {
  const LGVPlugin = pluginManager.getPlugin('LinearGenomeViewPlugin') as
    | LinearGenomeViewPlugin
    | undefined
  if (!LGVPlugin) {
    throw new Error('LinearGenomeView plugin not found')
  }
  const { BaseLinearDisplayComponent } = LGVPlugin.exports
  function ApolloDisplayComponent({
    model,
    ...other
  }: {
    model: LinearApolloDisplay
  }) {
    const { classes } = useStyles()
    const { height, selectedFeature } = model
    let { detailsHeight } = model
    if (!selectedFeature) {
      detailsHeight = 0
    }
    const featureAreaHeight = height - detailsHeight
    return (
      <div style={{ height: model.height }}>
        <div className={classes.shading} style={{ height: featureAreaHeight }}>
          <BaseLinearDisplayComponent model={model} {...other} />
        </div>
        <div className={classes.details} style={{ height: detailsHeight }}>
          <ApolloDetails model={model} />
        </div>
      </div>
    )
  }
  return observer(ApolloDisplayComponent)
}

export function makeSixFrameDisplayComponent(pluginManager: PluginManager) {
  const LGVPlugin = pluginManager.getPlugin('LinearGenomeViewPlugin') as
    | LinearGenomeViewPlugin
    | undefined
  if (!LGVPlugin) {
    throw new Error('LinearGenomeView plugin not found')
  }
  const { BaseLinearDisplayComponent } = LGVPlugin.exports
  function ApolloDisplayComponent({
    model,
    ...other
  }: {
    model: SixFrameFeatureDisplay
  }) {
    const { classes } = useStyles()
    const { height, selectedFeature } = model
    let { detailsHeight } = model
    if (!selectedFeature) {
      detailsHeight = 0
    }
    const featureAreaHeight = height - detailsHeight
    return (
      <div style={{ height: model.height }}>
        <div className={classes.shading} style={{ height: featureAreaHeight }}>
          <BaseLinearDisplayComponent model={model} {...other} />
        </div>
        {/* <div className={classes.details} style={{ height: detailsHeight }}>
          <ApolloDetails model={model} />
        </div> */}
        <div className="testTrackLines">
          <TrackLines model={model} />
        </div>
      </div>
    )
  }
  return observer(ApolloDisplayComponent)
}
