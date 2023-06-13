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
  onChange: (oldValue: string, newValue: string) => void
}) {
  const { value, style, feature, internetAccount } = props
  const [soSequenceTerms, setSOSequenceTerms] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const { classes } = useStyles()

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function getSOSequenceTerms() {
      const { type, parent, children } = feature
      let endpoint = `/ontologies/equivalents/sequence_feature`
      if (parent) {
        endpoint = `/ontologies/descendants/${parent.type}`
      } else if (children?.size) {
        endpoint = `/ontologies/equivalents/${type}`
      }
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
    // const isValid = await apiRef.current.setEditCellValue({
    //   id,
    //   field,
    //   value: newValue,
    // })
    // if (isValid) {
    //   apiRef.current.stopCellEditMode({ id, field })
    // }
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
