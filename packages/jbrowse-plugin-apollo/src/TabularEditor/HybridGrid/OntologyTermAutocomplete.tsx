import { Autocomplete } from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import React, { useEffect, useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { ApolloInternetAccountModel } from '../../ApolloInternetAccount/model'
import { createFetchErrorMessage } from '../../util'

const useStyles = makeStyles()((theme) => ({
  inputElement: {
    border: 'none',
    background: 'none',
  },
}))

export function OntologyTermAutocomplete(props: {
  internetAccount: ApolloInternetAccountModel
  value: string
  feature: AnnotationFeatureI
  style?: React.CSSProperties
  onChange: (oldValue: string, newValue: string | null | undefined) => void
}) {
  const { value, style, feature, internetAccount, onChange } = props
  const [soSequenceTerms, setSOSequenceTerms] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const { classes } = useStyles()

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function getSOSequenceTerms() {
      const soTerms = await getValidTermsForFeature(
        feature,
        internetAccount,
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
  }, [internetAccount, feature])

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

/** a stupid, temporary cache layer until we have a proper ontology store */
const responseCache = new Map<string, Promise<string[] | undefined>>()
async function getValidTermsForFeature(
  feature: AnnotationFeatureI,
  internetAccount: ApolloInternetAccountModel,
  signal: AbortSignal,
) {
  const { type, parent, children } = feature
  let endpoint = `/ontologies/equivalents/sequence_feature`
  if (parent) {
    endpoint = `/ontologies/descendants/${parent.type}`
  } else if (children?.size) {
    endpoint = `/ontologies/equivalents/${type}`
  }
  let responseP: Promise<string[] | undefined> | undefined
  if (responseCache.has(endpoint)) {
    responseP = responseCache.get(endpoint)
  } else {
    responseP = fetchValidTermsForFeature(endpoint, internetAccount, signal)
    responseCache.set(endpoint, responseP)
  }
  const response = await responseP
  return response
}
async function fetchValidTermsForFeature(
  endpoint: string,
  internetAccount: ApolloInternetAccountModel,
  signal: AbortSignal,
) {
  const { baseURL, getFetcher } = internetAccount
  const uri = new URL(endpoint, baseURL).href
  const apolloFetch = getFetcher({ locationType: 'UriLocation', uri })
  const response = await apolloFetch(uri, { method: 'GET', signal })
  if (!response.ok) {
    const newErrorMessage = await createFetchErrorMessage(
      response,
      'Error when retrieving ontologies from server',
    )
    throw new Error(newErrorMessage)
  }
  const soTerms = (await response.json()) as string[] | undefined
  return soTerms
}
