/* eslint-disable @typescript-eslint/unbound-method */
import { getSession } from '@jbrowse/core/util'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Alert, Typography, alpha } from '@mui/material'
import { observer } from 'mobx-react'
import React, { useCallback, useEffect, useRef } from 'react'
import { makeStyles } from 'tss-react/mui'

import { LinearApolloDisplay } from './LinearApolloDisplay/components'
import { type LinearApolloDisplay as LinearApolloDisplayI } from './LinearApolloDisplay/stateModel'
import { LinearApolloSixFrameDisplay } from './LinearApolloSixFrameDisplay/components'
import { type LinearApolloSixFrameDisplay as LinearApolloSixFrameDisplayI } from './LinearApolloSixFrameDisplay/stateModel'
import { TabularEditorPane } from './TabularEditor'
import { type ApolloSessionModel } from './session'

const accordionControlHeight = 12

const useStyles = makeStyles()((theme) => ({
  shading: {
    background: alpha(theme.palette.primary.main, 0.2),
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
  alertContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}))

function scrollSelectedFeatureIntoView(
  model: LinearApolloDisplayI | LinearApolloSixFrameDisplayI,
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

  return (
    // TODO: a11y
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      onMouseDown={(event: React.MouseEvent) => {
        event.stopPropagation()
        const controller = new AbortController()
        const { signal } = controller
        function abortDrag() {
          controller.abort(
            new DOMException('Canceling drag event listener', 'AbortError'),
          )
        }
        globalThis.addEventListener('mousemove', mouseMove, { signal })
        globalThis.addEventListener('mouseup', abortDrag, { signal })
        globalThis.addEventListener('mouseleave', abortDrag, { signal })
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

export const LinearApolloDisplayComponent = observer(function DisplayComponent({
  model,
  ...other
}: {
  model: LinearApolloDisplayI
}) {
  const session = getSession(model) as unknown as ApolloSessionModel
  const { ontologyManager } = session.apolloDataStore
  const { featureTypeOntology } = ontologyManager
  const ontologyStore = featureTypeOntology?.dataStore

  const { classes } = useStyles()

  const {
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
    model.setDetailsHeight(model.detailsHeight - delta)
  }

  if (!ontologyStore) {
    return (
      <div className={classes.alertContainer}>
        <Alert severity="error">Could not load feature type ontology.</Alert>
      </div>
    )
  }

  if (graphical && table) {
    const tabularHeight = tabularEditor.isShown ? model.detailsHeight : 0
    const featureAreaHeight = isShown
      ? overallHeight - model.detailsHeight - accordionControlHeight * 2
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

export const LinearApolloSixFrameDisplayComponent = observer(
  function DisplayComponent({
    model,
    ...other
  }: {
    model: LinearApolloSixFrameDisplayI
  }) {
    const session = getSession(model) as unknown as ApolloSessionModel
    const { ontologyManager } = session.apolloDataStore
    const { featureTypeOntology } = ontologyManager
    const ontologyStore = featureTypeOntology?.dataStore

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

    if (!ontologyStore) {
      return (
        <div className={classes.alertContainer}>
          <Alert severity="error">Could not load feature type ontology.</Alert>
        </div>
      )
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
            <LinearApolloSixFrameDisplay model={model} {...other} />
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
          <LinearApolloSixFrameDisplay model={model} {...other} />
        </div>
      )
    }

    return (
      <div className={classes.details} style={{ height: overallHeight }}>
        <TabularEditorPane model={model} />
      </div>
    )
  },
)
