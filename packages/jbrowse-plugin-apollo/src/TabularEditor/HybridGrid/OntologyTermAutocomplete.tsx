import { getSession } from '@jbrowse/core/util'
import { Autocomplete } from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import { Instance } from 'mobx-state-tree'
import React, { useEffect, useRef, useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { ApolloInternetAccountModel } from '../../ApolloInternetAccount/model'
import type OntologyManager from '../../OntologyManager'
import { OntologyTerm } from '../../OntologyManager'
import { DisplayStateModel } from '../types'

const useStyles = makeStyles()({
  inputElement: {
    border: 'none',
    background: 'none',
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
  const { value, style, feature, internetAccount, displayState, onChange } =
    props
  const [soSequenceTerms, setSOSequenceTerms] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const { classes } = useStyles()

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function getSOSequenceTerms() {
      const soTerms = await getValidTermsForFeature(
        displayState,
        feature,
        signal,
      )
      if (soTerms && !signal.aborted) {
        setSOSequenceTerms(soTerms)
      }
    }
    getSOSequenceTerms().catch((e) => {
      if (!signal.aborted) {
        setErrorMessage(String(e))
      }
    })
    return () => {
      controller.abort()
    }
  }, [displayState, feature])

  const handleChange = async (
    event: React.SyntheticEvent<Element, Event>,
    newValue?: string | null,
  ) => {
    if (newValue !== value) {
      onChange(value, newValue)
    }
  }

  if (!soSequenceTerms.length) {
    return null
  }

  const extraTextFieldParams: { error?: boolean; helperText?: string } = {}
  if (errorMessage) {
    extraTextFieldParams.error = true
    extraTextFieldParams.helperText = errorMessage
  }

  return (
    <Autocomplete
      options={soSequenceTerms}
      style={style}
      freeSolo={true}
      renderInput={(params) => {
        return (
          <div ref={params.InputProps.ref}>
            <input
              type="text"
              {...params.inputProps}
              className={classes.inputElement}
              style={{ width: 170 }}
            />
          </div>
        )
      }}
      value={String(value)}
      onChange={handleChange}
      disableClearable
      selectOnFocus
      handleHomeEndKeys
    />
  )
}

// async function oldValidTermsForFeature(
//   displayState: DisplayStateModel,
//   feature: AnnotationFeatureI,
//   signal: AbortSignal,
// ) {
//   const { type, parent, children } = feature
//   let endpoint = `/ontologies/equivalents/sequence_feature`
//   if (parent) {
//     endpoint = `/ontologies/descendants/${parent.type}`
//   } else if (children?.size) {
//     endpoint = `/ontologies/equivalents/${type}`
//   }
//   let responseP: Promise<string[] | undefined> | undefined
//   if (responseCache.has(endpoint)) {
//     responseP = responseCache.get(endpoint)
//   } else {
//     responseP = fetchValidTermsForFeature(endpoint, internetAccount, signal)
//     responseCache.set(endpoint, responseP)
//   }
//   const response = await responseP
//   return response
// }

async function getValidTermsForFeature(
  displayState: DisplayStateModel,
  feature: AnnotationFeatureI,
  signal: AbortSignal,
): Promise<string[] | undefined> {
  const session = getSession(displayState)
  const ontologyManager = session.apolloDataStore.ontologyManager as Instance<
    typeof OntologyManager
  >
  const featureTypeOntology = ontologyManager.featureTypeOntology?.dataStore
  if (!featureTypeOntology) {
    return []
  }
  const { type, parent, children } = feature

  // const resultTerms = await featureTypeOntology.getAllTerms()
  let resultTerms: OntologyTerm[] | undefined
  if (parent) {
    const [parentTypeTerm] =
      await featureTypeOntology.getTermsWithLabelOrSynonym(parent.type)
    if (parentTypeTerm) {
      // find all the terms that are part_of the parent term
      const [partOf] = await (
        await featureTypeOntology.getTermsWithLabelOrSynonym('part_of')
      ).filter((t) => t.type === 'PROPERTY')

      
    }
  } else {
  }
  // const terms = parent
  //   ? featureTypeOntology.getValidPartsOf(parent.type)
  //   : featureTypeOntology.getStandaloneTerms()

  if (!resultTerms) {
    resultTerms = await featureTypeOntology.getAllTerms()
  }

  return !resultTerms
    ? []
    : resultTerms
        .map((t) => t.lbl || '(no label)')
        // .map((term) => {
        //   // make the term display name
        //   return `${term.lbl || '(no label)'} ${ontologyManager.applyPrefixes(
        //     term.id || '(no id)',
        //   )}`
        // })
        .sort()
}
