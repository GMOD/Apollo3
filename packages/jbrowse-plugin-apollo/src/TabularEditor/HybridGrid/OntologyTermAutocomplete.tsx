import { getSession } from '@jbrowse/core/util'
import { Autocomplete } from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import { Instance } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { ApolloInternetAccountModel } from '../../ApolloInternetAccount/model'
import type OntologyManager from '../../OntologyManager'
import { OntologyClass, isOntologyClass } from '../../OntologyManager'
import { DisplayStateModel } from '../types'

const useStyles = makeStyles()({
  inputElement: {
    border: 'none',
    background: 'none',
  },
  errorMessage: {
    color: 'red',
  },
})

export function OntologyTermAutocomplete(props: {
  displayState: DisplayStateModel
  internetAccount: ApolloInternetAccountModel
  value: string
  feature: AnnotationFeatureI
  style?: React.CSSProperties
  onChange: (oldValue: string, newValue: string | null | undefined) => void
}) {
  const { value: valueString, style, feature, displayState, onChange } = props
  const { classes } = useStyles()

  const [open, setOpen] = useState(false)
  const [soSequenceTerms, setSOSequenceTerms] = useState<
    OntologyClass[] | undefined
  >()
  const [currentOntologyTermInvalid, setCurrentOntologyTermInvalid] =
    useState('')
  const [currentOntologyTerm, setCurrentOntologyTerm] = useState<
    OntologyClass | undefined
  >()

  const needToLoadTermChoices = open && !soSequenceTerms
  const needToLoadCurrentTerm = !currentOntologyTerm

  // effect for clearing choices when not open
  useEffect(() => {
    if (!open) {
      setSOSequenceTerms(undefined)
    }
  }, [open])

  // effect for matching the current value with an ontology term
  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    if (needToLoadCurrentTerm) {
      getCurrentTerm(displayState, valueString, signal).then(
        setCurrentOntologyTerm,
        (err) => {
          if (!signal.aborted) {
            setCurrentOntologyTermInvalid(String(err))
          }
        },
      )
    }
    return () => {
      controller.abort()
    }
  }, [displayState, valueString, needToLoadCurrentTerm])

  // effect for loading term autocompletions
  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    if (!needToLoadTermChoices) {
      return undefined
    }

    getValidTermsForFeature(displayState, feature, signal).then(
      (soTerms) => {
        if (soTerms && !signal.aborted) {
          setSOSequenceTerms(soTerms)
        }
      },
      (error) => {
        if (!signal.aborted) {
          getSession(displayState).notify(error.message, 'error')
        }
      },
    )
    return () => {
      controller.abort()
    }
  }, [needToLoadTermChoices, displayState, feature])

  const handleChange = async (
    event: React.SyntheticEvent<Element, Event>,
    newValue?: OntologyClass | null,
  ) => {
    if (newValue && newValue.lbl !== valueString) {
      setCurrentOntologyTerm(newValue)
      onChange(valueString, newValue.lbl)
    }
  }

  return (
    <Autocomplete
      options={soSequenceTerms || []}
      style={style}
      onOpen={() => {
        setOpen(true)
      }}
      onClose={() => {
        setOpen(false)
      }}
      loading={needToLoadTermChoices}
      renderInput={(params) => {
        return (
          <div ref={params.InputProps.ref}>
            <input
              type="text"
              {...params.inputProps}
              className={classes.inputElement}
              style={{ width: 170 }}
            />
            {currentOntologyTermInvalid ? (
              <div className={classes.errorMessage}>
                {currentOntologyTermInvalid}
              </div>
            ) : null}
          </div>
        )
      }}
      getOptionLabel={(option) => option.lbl || '(no label)'}
      isOptionEqualToValue={(option, val) => option.lbl === val.lbl}
      value={
        currentOntologyTerm || {
          lbl: valueString,
          id: 'LOADING',
          type: 'CLASS',
        }
      }
      onChange={handleChange}
      disableClearable
      selectOnFocus
      handleHomeEndKeys
    />
  )
}

async function getCurrentTerm(
  displayState: DisplayStateModel,
  currentTermLabel: string,
  signal: AbortSignal,
) {
  const session = getSession(displayState)
  const ontologyManager = session.apolloDataStore.ontologyManager as Instance<
    typeof OntologyManager
  >
  const featureTypeOntology = ontologyManager.featureTypeOntology?.dataStore
  if (!featureTypeOntology) {
    throw new Error('no feature type ontology set in ontology manager')
  }

  // TODO: search by prefixed ID
  const terms = await featureTypeOntology.getNodesWithLabelOrSynonym(
    currentTermLabel,
  )
  const term = terms.find(isOntologyClass)
  if (!term) {
    throw new Error(`not a valid ${featureTypeOntology.ontologyName} term`)
  }

  return term
}

async function getValidTermsForFeature(
  displayState: DisplayStateModel,
  feature: AnnotationFeatureI,
  signal: AbortSignal,
) {
  const session = getSession(displayState)
  const ontologyManager = session.apolloDataStore.ontologyManager as Instance<
    typeof OntologyManager
  >
  const featureTypeOntology = ontologyManager.featureTypeOntology?.dataStore
  if (!featureTypeOntology) {
    throw new Error('no feature type ontology set in ontology manager')
  }
  const { parent: parentFeature } = feature

  let resultTerms: OntologyClass[] | undefined
  if (parentFeature) {
    // if this is a child of an existing feature, restrict the autocomplete choices to valid
    // parts of that feature
    const parentTypeTerms = (
      await featureTypeOntology.getNodesWithLabelOrSynonym(parentFeature.type, {
        includeSubclasses: false,
      })
    ).filter(isOntologyClass)
    if (parentTypeTerms.length) {
      const subpartTerms = await featureTypeOntology.getTermsThat(
        'part_of',
        parentTypeTerms,
      )
      resultTerms = subpartTerms
    }
  }

  // if we could not figure out any restrictions, just autocomplete with all the SO terms
  if (!resultTerms) {
    resultTerms = await featureTypeOntology.getAllTerms()
  }

  return resultTerms || []
}
