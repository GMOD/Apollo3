/* eslint-disable unicorn/no-nested-ternary */
/* eslint-disable @typescript-eslint/unbound-method */

import { AnnotationFeature } from '@apollo-annotation/mst'
import { AbstractSessionModel } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import React from 'react'
import { makeStyles } from 'tss-react/mui'

import { OntologyTermAutocomplete } from '../../components/OntologyTermAutocomplete'
import { isOntologyClass } from '../../OntologyManager'
import OntologyStore from '../../OntologyManager/OntologyStore'
import { DisplayStateModel } from '../types'
import {
  handleFeatureEndChange,
  handleFeatureStartChange,
  handleFeatureTypeChange,
} from './ChangeHandling'
import { FeatureAttributes } from './FeatureAttributes'
import { featureContextMenuItems } from './featureContextMenuItems'
import type { ContextMenuState } from './HybridGrid'
import { NumberCell } from './NumberCell'

const useStyles = makeStyles()((theme) => ({
  typeContent: {
    display: 'inline-block',
    width: '174px',
    height: '100%',
    cursor: 'text',
  },
  feature: {
    td: {
      position: 'relative',
      verticalAlign: 'top',
      paddingLeft: '0.5em',
    },
  },
  arrow: {
    display: 'inline-block',
    width: '1.6em',
    textAlign: 'center',
    cursor: 'pointer',
  },
  arrowExpanded: {
    transform: 'rotate(90deg)',
  },
  hoveredFeature: {
    backgroundColor: theme.palette.action.hover,
  },
  typeInputElement: {
    border: 'none',
    background: 'none',
  },
  typeErrorMessage: {
    color: 'red',
  },
}))

function makeContextMenuItems(
  display: DisplayStateModel,
  feature: AnnotationFeature,
) {
  const {
    changeManager,
    getAssemblyId,
    regions,
    selectedFeature,
    session,
    setSelectedFeature,
  } = display
  return featureContextMenuItems(
    feature,
    regions[0],
    getAssemblyId,
    selectedFeature,
    setSelectedFeature,
    session,
    changeManager,
  )
}

function getTopLevelFeature(feature: AnnotationFeature): AnnotationFeature {
  let cur = feature
  while (cur.parent) {
    cur = cur.parent
  }
  return cur
}

export const Feature = observer(function Feature({
  depth,
  feature,
  isHovered,
  isSelected,
  model: displayState,
  selectedFeatureClass,
  setContextMenu,
}: {
  model: DisplayStateModel
  feature: AnnotationFeature
  depth: number
  isHovered: boolean
  isSelected: boolean
  selectedFeatureClass: string
  setContextMenu: (menu: ContextMenuState) => void
}) {
  const { classes } = useStyles()
  const {
    apolloHover,
    changeManager,
    selectedFeature,
    session,
    tabularEditor: tabularEditorState,
  } = displayState
  const { featureCollapsed, filterText } = tabularEditorState
  const { _id, children, max, min, strand, type } = feature
  const expanded = !featureCollapsed.get(_id)
  const toggleExpanded = (e: React.MouseEvent) => {
    e.stopPropagation()
    tabularEditorState.setFeatureCollapsed(_id, expanded)
  }

  // pop up a snackbar in the session notifying user of an error
  const notifyError = (e: Error) => {
    ;(session as unknown as AbstractSessionModel).notify(e.message, 'error')
  }

  return (
    <>
      <tr
        onMouseEnter={(_e) => {
          displayState.setApolloHover({
            feature,
            topLevelFeature: getTopLevelFeature(feature),
            // @ts-expect-error TODO fix in future when moving hover logic to session.
            glyph: displayState.getGlyph(getTopLevelFeature(feature)),
          })
        }}
        className={
          classes.feature +
          (isSelected
            ? ` ${selectedFeatureClass}`
            : isHovered
              ? ` ${classes.hoveredFeature}`
              : '')
        }
        onClick={(e) => {
          e.stopPropagation()
          displayState.setSelectedFeature(feature)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          setContextMenu({
            position: { left: e.clientX + 2, top: e.clientY - 6 },
            items: makeContextMenuItems(displayState, feature),
          })
          return false
        }}
      >
        <td
          style={{
            whiteSpace: 'nowrap',
            borderLeft: `${depth * 2}em solid transparent`,
          }}
        >
          {children?.size ? (
            // TODO: a11y
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            <div
              onClick={toggleExpanded}
              className={
                classes.arrow + (expanded ? ` ${classes.arrowExpanded}` : '')
              }
            >
              ❯
            </div>
          ) : null}
          <div className={classes.typeContent}>
            <OntologyTermAutocomplete
              session={session}
              ontologyName="Sequence Ontology"
              style={{ width: 170 }}
              value={type}
              filterTerms={isOntologyClass}
              fetchValidTerms={fetchValidTypeTerms.bind(null, feature)}
              renderInput={(params) => {
                return (
                  <div ref={params.InputProps.ref}>
                    <input
                      type="text"
                      {...params.inputProps}
                      className={classes.typeInputElement}
                      style={{ width: 170 }}
                    />
                    {params.error ? (
                      <div className={classes.typeErrorMessage}>
                        {params.errorMessage ?? 'unknown error'}
                      </div>
                    ) : null}
                  </div>
                )
              }}
              onChange={(oldValue, newValue) => {
                if (newValue) {
                  handleFeatureTypeChange(
                    changeManager,
                    feature,
                    oldValue,
                    newValue,
                  ).catch(notifyError)
                }
              }}
            />
          </div>
        </td>
        <td>
          <NumberCell
            initialValue={min + 1}
            notifyError={notifyError}
            onChangeCommitted={(newStart) =>
              handleFeatureStartChange(
                changeManager,
                feature,
                min,
                newStart - 1,
              )
            }
          />
        </td>
        <td>
          <NumberCell
            initialValue={max}
            notifyError={notifyError}
            onChangeCommitted={(newEnd) =>
              handleFeatureEndChange(changeManager, feature, max, newEnd)
            }
          />
        </td>
        <td>{strand === 1 ? '+' : strand === -1 ? '-' : undefined}</td>
        <td>
          <FeatureAttributes filterText={filterText} feature={feature} />
        </td>
      </tr>
      {expanded && children
        ? [...children.entries()]
            .filter((entry) => {
              if (!filterText) {
                return true
              }
              const [, childFeature] = entry
              // search feature and its subfeatures for the text
              const text = JSON.stringify(childFeature)
              return text.includes(filterText)
            })
            .map(([featureId, childFeature]) => {
              const childHovered = apolloHover?.feature._id === childFeature._id
              const childSelected = selectedFeature?._id === childFeature._id
              return (
                <Feature
                  isHovered={childHovered}
                  isSelected={childSelected}
                  selectedFeatureClass={selectedFeatureClass}
                  key={featureId}
                  depth={(depth || 0) + 1}
                  feature={childFeature}
                  model={displayState}
                  setContextMenu={setContextMenu}
                />
              )
            })
        : null}
    </>
  )
})
async function fetchValidTypeTerms(
  feature: AnnotationFeature,
  ontologyStore: OntologyStore,
  _signal: AbortSignal,
) {
  const { parent: parentFeature } = feature
  if (parentFeature) {
    // if this is a child of an existing feature, restrict the autocomplete choices to valid
    // parts of that feature
    const parentTypeTerms = await ontologyStore.getTermsWithLabelOrSynonym(
      parentFeature.type,
      { includeSubclasses: false },
    )
    // eslint-disable-next-line unicorn/no-array-callback-reference
    const parentTypeClassTerms = parentTypeTerms.filter(isOntologyClass)
    if (parentTypeClassTerms.length > 0) {
      const subpartTerms = await ontologyStore.getClassesThat(
        'part_of',
        parentTypeClassTerms,
      )
      return subpartTerms
    }
  }
  return
}
