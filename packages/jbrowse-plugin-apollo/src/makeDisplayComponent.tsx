/* eslint-disable @typescript-eslint/unbound-method */
import PluginManager from '@jbrowse/core/PluginManager'
import type LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Typography, alpha } from '@mui/material'
import { observer } from 'mobx-react'
import React, { useCallback, useEffect, useRef } from 'react'
import { makeStyles } from 'tss-react/mui'

import { LinearApolloDisplay } from './LinearApolloDisplay/components'
import { LinearApolloDisplay as LinearApolloDisplayI } from './LinearApolloDisplay/stateModel'
import { TrackLines } from './SixFrameFeatureDisplay/components'
import { SixFrameFeatureDisplay } from './SixFrameFeatureDisplay/stateModel'
import { TabularEditorPane } from './TabularEditor'

const accordionControlHeight = 12

const useStyles = makeStyles()((theme) => ({
  shading: {
    background: alpha(theme.palette.primary.main, 0.2),
    overflowY: 'scroll',
    overflowX: 'hidden',
  },
  details: {
    background: theme.palette.background.paper,
  },
  accordionControl: {
    height: accordionControlHeight,
    width: '100%',
    '&:hover': {
      background: theme.palette.action.hover,
    },
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionRoot: {
    background: theme.palette.divider,
  },
  resizeHandle: {
    width: '100%',
    height: 4,
    position: 'absolute',
    cursor: 'row-resize',
    zIndex: 100,
  },
  expandIcon: {
    // position: 'relative',
  },
  title: {
    // position: 'relative',
    userSelect: 'none',
  },
}))

function scrollSelectedFeatureIntoView(
  model: LinearApolloDisplayI,
  scrollContainerRef: React.RefObject<HTMLDivElement>,
) {
  const { apolloRowHeight, selectedFeature } = model
  if (scrollContainerRef.current && selectedFeature) {
    const position = model.getFeatureLayoutPosition(selectedFeature)
    if (position) {
      const row = position.layoutRow + position.featureRow
      const top = row * apolloRowHeight
      scrollContainerRef.current.scroll({ top, behavior: 'smooth' })
    }
  }
}

const ResizeHandle = ({
  onResize,
}: {
  onResize: (sizeDelta: number) => void
}) => {
  const { classes } = useStyles()
  const mouseMove = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation()
      event.preventDefault()
      onResize(event.movementY)
    },
    [onResize],
  )
  const cancelDrag: (event: MouseEvent) => void = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation()
      event.preventDefault()
      window.removeEventListener('mousemove', mouseMove)
      window.removeEventListener('mouseup', cancelDrag)
      window.removeEventListener('mouseleave', cancelDrag)
    },
    [mouseMove],
  )
  return (
    // TODO: a11y
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      onMouseDown={(event: React.MouseEvent) => {
        event.stopPropagation()
        window.addEventListener('mousemove', mouseMove)
        window.addEventListener('mouseup', cancelDrag)
        window.addEventListener('mouseleave', cancelDrag)
      }}
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
      }}
      className={classes.resizeHandle}
    />
  )
}

const AccordionControl = observer(function AccordionControl({
  onClick,
  onResize,
  open,
  title,
}: {
  open: boolean
  onClick: (e: React.MouseEvent) => void
  onResize?: (sizeDelta: number) => void
  title?: string
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.accordionRoot}>
      {open && onResize ? <ResizeHandle onResize={onResize} /> : null}
      {/* TODO: a11y */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className={classes.accordionControl} onClick={onClick}>
        {open ? (
          <ExpandLessIcon className={classes.expandIcon} />
        ) : (
          <ExpandMoreIcon className={classes.expandIcon} />
        )}
        {title ? (
          <Typography
            className={classes.title}
            variant="caption"
            component="span"
          >
            {title}
          </Typography>
        ) : null}
      </div>
    </div>
  )
})

export const DisplayComponent = observer(function DisplayComponent({
  model,
  ...other
}: {
  model: LinearApolloDisplayI
}) {
  const { classes } = useStyles()

  const {
    detailsHeight,
    graphical,
    height: overallHeight,
    isShown,
    selectedFeature,
    table,
    tabularEditor,
    toggleShown,
  } = model

  const canvasScrollContainerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollSelectedFeatureIntoView(model, canvasScrollContainerRef)
  }, [model, selectedFeature])

  const onDetailsResize = (delta: number) => {
    model.setDetailsHeight(detailsHeight - delta)
  }

  if (graphical && table) {
    const tabularHeight = tabularEditor.isShown ? detailsHeight : 0
    const featureAreaHeight = isShown
      ? overallHeight - detailsHeight - accordionControlHeight * 2
      : 0
    return (
      <div style={{ height: overallHeight }}>
        <AccordionControl
          open={isShown}
          title="Graphical"
          onClick={toggleShown}
        />
        <div
          className={classes.shading}
          ref={canvasScrollContainerRef}
          style={{ height: featureAreaHeight }}
        >
          <LinearApolloDisplay model={model} {...other} />
        </div>
        <AccordionControl
          title="Table"
          open={tabularEditor.isShown}
          onClick={tabularEditor.togglePane}
          onResize={onDetailsResize}
        />
        <div className={classes.details} style={{ height: tabularHeight }}>
          <TabularEditorPane model={model} />
        </div>
      </div>
    )
  }

  if (graphical) {
    return (
      <div
        className={classes.shading}
        ref={canvasScrollContainerRef}
        style={{ height: overallHeight }}
      >
        <LinearApolloDisplay model={model} {...other} />
      </div>
    )
  }

  return (
    <div className={classes.details} style={{ height: overallHeight }}>
      <TabularEditorPane model={model} />
    </div>
  )
})

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
