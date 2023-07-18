import { getSession, isAbortException } from '@jbrowse/core/util'
import {
  Autocomplete,
  AutocompleteRenderInputParams,
  TextField,
} from '@mui/material'
import React, { useCallback, useEffect, useState } from 'react'

import type { OntologyManager } from '../OntologyManager'
import { OntologyTerm, isDeprecated } from '../OntologyManager'
import OntologyStore from '../OntologyManager/OntologyStore'

interface OntologyTermAutocompleteProps {
  session: ReturnType<typeof getSession>
  ontologyName: string
  ontologyVersion?: string
  value: string
  error?: boolean
  filterTerms?: (term: OntologyTerm) => boolean
  fetchValidTerms?: (
    ontologyStore: OntologyStore,
    signal: AbortSignal,
  ) => Promise<OntologyTerm[] | undefined>
  style?: React.CSSProperties
  renderInput?: (
    params: AutocompleteRenderInputParams & {
      error?: boolean
      errorMessage?: string
    },
  ) => React.ReactNode
  onChange: (oldValue: string, newValue: string | null | undefined) => void
  /** if true, include deprecated/obsolete terms */
  includeDeprecated?: boolean
}

export function OntologyTermAutocomplete({
  fetchValidTerms,
  filterTerms: filterTermsProp,
  includeDeprecated,
  onChange,
  ontologyName,
  ontologyVersion,
  renderInput,
  session,
  style,
  value: valueString,
}: OntologyTermAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [termChoices, setTermChoices] = useState<OntologyTerm[] | undefined>()
  const [currentOntologyTermInvalid, setCurrentOntologyTermInvalid] =
    useState('')
  const [currentOntologyTerm, setCurrentOntologyTerm] = useState<
    OntologyTerm | undefined
  >()

  const ontologyManager = session.apolloDataStore
    .ontologyManager as OntologyManager
  const ontologyStore = ontologyManager.findOntology(
    ontologyName,
    ontologyVersion,
  )?.dataStore

  const needToLoadTermChoices = ontologyStore && open && !termChoices
  const needToLoadCurrentTerm = ontologyStore && !currentOntologyTerm

  const filterTerms = useCallback(
    (term: OntologyTerm) =>
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      (includeDeprecated || !isDeprecated(term)) &&
      (!filterTermsProp || filterTermsProp(term)),
    [filterTermsProp, includeDeprecated],
  )

  // effect for clearing choices when not open
  useEffect(() => {
    if (!open) {
      setTermChoices(undefined)
    }
  }, [open])

  // effect for matching the current value with an ontology term
  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    if (needToLoadCurrentTerm) {
      setCurrentOntologyTermInvalid('')
      getCurrentTerm(ontologyStore, valueString, filterTerms, signal).then(
        (term) => {
          if (!signal.aborted) {
            setCurrentOntologyTerm(term)
          }
        },
        (err) => {
          if (!signal.aborted && !isAbortException(err)) {
            setCurrentOntologyTermInvalid(String(err))
          }
        },
      )
    }
    return () => {
      controller.abort()
    }
  }, [session, valueString, filterTerms, ontologyStore, needToLoadCurrentTerm])

  // effect for loading term autocompletions
  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    if (needToLoadTermChoices) {
      getValidTerms(ontologyStore, fetchValidTerms, filterTerms, signal).then(
        (soTerms) => {
          if (soTerms && !signal.aborted) {
            setTermChoices(soTerms)
          }
        },
        (error) => {
          if (!signal.aborted && !isAbortException(error)) {
            session.notify(error.message, 'error')
          }
        },
      )
    }
    return () => {
      controller.abort()
    }
  }, [
    needToLoadTermChoices,
    filterTerms,
    ontologyStore,
    session,
    fetchValidTerms,
  ])

  const handleChange = async (
    event: React.SyntheticEvent<Element, Event>,
    newValue?: OntologyTerm | string | null,
  ) => {
    if (!newValue) {
      return
    }
    if (typeof newValue === 'string') {
      setCurrentOntologyTerm(undefined)
      onChange(valueString, newValue)
    } else if (newValue.lbl !== valueString) {
      setCurrentOntologyTermInvalid('')
      setCurrentOntologyTerm(newValue)
      onChange(valueString, newValue.lbl)
    }
  }

  const extraTextFieldParams: { error?: boolean; helperText?: string } = {}
  if (currentOntologyTermInvalid) {
    extraTextFieldParams.error = true
    extraTextFieldParams.helperText = currentOntologyTermInvalid
  }

  return (
    <Autocomplete
      style={style}
      autoComplete
      filterSelectedOptions
      disableClearable
      selectOnFocus
      clearOnBlur
      handleHomeEndKeys
      freeSolo={true}
      value={valueString}
      options={termChoices ?? []}
      onOpen={() => {
        setOpen(true)
      }}
      onClose={() => {
        setOpen(false)
      }}
      // noOptionsText={valueString ? 'No matches' : 'Start typing to search'}
      loading={needToLoadTermChoices}
      renderInput={
        renderInput ??
        ((params) => <TextField {...params} {...extraTextFieldParams} />)
      }
      getOptionLabel={(option) => {
        if (typeof option === 'string') {
          return option
        }
        return option.lbl ?? ''
      }}
      isOptionEqualToValue={(option, val) => option.lbl === val.lbl}
      onChange={handleChange}
    />
  )
}

async function getCurrentTerm(
  ontologyStore: OntologyStore,
  currentTermLabel: string,
  filterTerms: OntologyTermAutocompleteProps['filterTerms'],
  _signal: AbortSignal,
) {
  if (!currentTermLabel) {
    return
  }

  // TODO: support prefixed IDs as ontology terms here (e.g. SO:001234)
  const terms = await ontologyStore.getTermsWithLabelOrSynonym(
    currentTermLabel,
    { includeSubclasses: false },
  )
  const term = terms.find(filterTerms ?? (() => true))
  if (!term) {
    throw new Error(`not a valid ${ontologyStore.ontologyName} term`)
  }

  return term
}

async function getValidTerms(
  ontologyStore: OntologyStore,
  fetchValidTerms: OntologyTermAutocompleteProps['fetchValidTerms'],
  filterTerms: OntologyTermAutocompleteProps['filterTerms'],
  signal: AbortSignal,
) {
  let result: OntologyTerm[] | undefined
  if (fetchValidTerms) {
    const customTermList = await fetchValidTerms(ontologyStore, signal)
    if (customTermList) {
      result = customTermList
    }
  }

  if (!result) {
    result = await ontologyStore.getAllTerms()
  }
  return filterTerms ? result.filter(filterTerms) : result
}
