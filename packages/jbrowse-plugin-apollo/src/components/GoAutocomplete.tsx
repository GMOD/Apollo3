import {
  Autocomplete,
  AutocompleteRenderGetTagProps,
  Chip,
  Grid,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { debounce } from '@mui/material/utils'
import match from 'autosuggest-highlight/match'
import parse from 'autosuggest-highlight/parse'
import * as React from 'react'

import { createFetchErrorMessage } from '../util'
import { Stores, getDataByIdOrDesc, getStoreDataCount } from './db'
import {
  AttributeValueEditorProps,
  GOTerm as GODBResult,
} from './ModifyFeatureAttribute'

interface GOValue {
  id: string
}

interface GOAutocompleteResult extends GOValue {
  label: string[]
  match: string
  category: string[]
  taxon: string
  taxon_label: string
  highlight: string
  has_highlight: boolean
}

interface GOAutocompleteResponse {
  docs: GOAutocompleteResult[]
}

interface GOLookupResult {
  goid: string
  label: string
  definition: string
  synonyms: string[]
  relatedSynonyms: string[]
  alternativeIds: string[]
  xrefs: string[]
  subsets: string[]
}

const hiliteRegex = /(?<=<em class="hilite">)(.*?)(?=<\/em>)/g

function GoTagWithTooltip({
  goId,
  index,
  getTagProps,
}: {
  goId: string
  index: number
  getTagProps: AutocompleteRenderGetTagProps
}) {
  const [description, setDescription] = React.useState('')
  const [errorMessage, setErrorMessage] = React.useState('')

  React.useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function fetchDescription() {
      try {
        const recCount = await getStoreDataCount()

        // Check if we use API or IndexedDb
        if (!recCount) {
          const response = await fetch(
            `https://api.geneontology.org/api/ontology/term/${goId}`,
            { signal },
          )
          if (!response.ok) {
            const message = await createFetchErrorMessage(
              response,
              `Failed to fetch GO term ${goId}`,
            )
            setErrorMessage(message)
            return
          }
          const goTerm = (await response.json()) as GOLookupResult
          const { label } = goTerm
          if (label && !signal.aborted) {
            setDescription(label)
          }
        } else {
          const goTerm: GODBResult[] = await getDataByIdOrDesc(
            Stores.GOTerms,
            goId,
          )
          if (goTerm[0]) {
            const [{ label }] = goTerm
            if (label && !signal.aborted) {
              setDescription(label)
            }
          }
        }
      } catch (e) {
        console.error(e)
      }
    }
    fetchDescription().catch((e) => setErrorMessage(String(e)))

    return () => {
      controller.abort()
    }
  }, [goId])

  return (
    <Tooltip title={description}>
      <div>
        <Chip
          label={errorMessage || goId}
          color={errorMessage ? 'error' : 'default'}
          size="small"
          {...getTagProps({ index })}
        />
      </div>
    </Tooltip>
  )
}

export function GoAutocomplete({
  value: initialValue,
  onChange,
}: AttributeValueEditorProps) {
  const [value, setValue] = React.useState<
    (GOValue | GOAutocompleteResult | GODBResult)[]
  >(initialValue.map((v) => ({ id: v })))
  const [inputValue, setInputValue] = React.useState('')
  const [options, setOptions] = React.useState<
    readonly (GOValue | GOAutocompleteResult | GODBResult)[]
  >([])
  const [loading, setLoading] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState('')

  const goFetch = React.useMemo(
    () =>
      debounce(
        async (
          request: { input: string },
          callback: (results: (GOAutocompleteResult | GODBResult)[]) => void,
        ) => {
          try {
            const recCount = await getStoreDataCount()
            // Check if we use API or IndexedDb
            if (recCount === undefined || recCount < 1) {
              const response = await fetch(
                `https://api.geneontology.org/api/search/entity/autocomplete/${request.input}?prefix=GO`,
              )
              const responseJson: GOAutocompleteResponse = await response.json()
              callback(responseJson.docs)
            } else {
              const goTerm = await getDataByIdOrDesc(
                Stores.GOTerms,
                request.input,
              )
              callback(goTerm)
            }
          } catch (error) {
            setErrorMessage(String(error))
          }
        },
        400,
      ),
    [],
  )

  React.useEffect(() => {
    let active = true

    if (inputValue === '') {
      setOptions(value.length ? value : [])
      return undefined
    }

    // `void`ed because types are wrong, this doesn't actually return a promise
    void goFetch({ input: inputValue }, (results) => {
      if (active) {
        let newOptions: readonly (
          | GOValue
          | GOAutocompleteResult
          | GODBResult
        )[] = []
        if (value.length) {
          newOptions = value
        }
        if (results) {
          newOptions = [...newOptions, ...results]
        }
        setOptions(newOptions)
        setLoading(false)
      }
    })

    return () => {
      active = false
    }
  }, [value, inputValue, goFetch])

  const extraTextFieldParams: { error?: boolean; helperText?: string } = {}
  if (errorMessage) {
    extraTextFieldParams.error = true
    extraTextFieldParams.helperText = errorMessage
  }

  return (
    <Autocomplete
      getOptionLabel={(option) => option.id}
      filterOptions={(x) => x}
      options={options}
      autoComplete
      includeInputInList
      filterSelectedOptions
      value={value}
      loading={loading}
      isOptionEqualToValue={(option, v) => option.id === v.id}
      noOptionsText={inputValue ? 'No matches' : 'Start typing to search'}
      onChange={(_, newValue) => {
        setOptions(newValue ? [...newValue, ...options] : options)
        onChange(newValue.map((v) => v.id))
        setValue(newValue)
      }}
      onInputChange={(event, newInputValue) => {
        if (newInputValue) {
          setLoading(true)
        }
        setOptions([])
        setInputValue(newInputValue)
      }}
      multiple
      renderInput={(params) => (
        <TextField
          {...params}
          {...extraTextFieldParams}
          variant="outlined"
          fullWidth
        />
      )}
      renderOption={(props, option) => {
        let parts: { text: string; highlight: boolean }[] = []
        if ('has_highlight' in option) {
          if (option.has_highlight) {
            const highlightedText = option.highlight.match(hiliteRegex)
            if (highlightedText) {
              parts = option.highlight
                .split(/<em class="hilite">|<\/em>/)
                .map((part) => ({
                  text: part,
                  highlight: highlightedText.includes(part),
                }))
            } else {
              parts = [{ text: option.match, highlight: false }]
            }
          }
        } else if ('label' in option) {
          const matches = match(option.label, inputValue, { insideWords: true })
          parts = parse(option.label, matches)
        }
        return (
          <li {...props}>
            <Grid container>
              <Grid item>
                <Typography>{option.id}</Typography>
                {parts.map((part, index) => (
                  <Typography
                    key={index}
                    component="span"
                    sx={{ fontWeight: part.highlight ? 'bold' : 'regular' }}
                    variant="body2"
                    color="text.secondary"
                  >
                    {part.text}
                  </Typography>
                ))}
              </Grid>
            </Grid>
          </li>
        )
      }}
      renderTags={(v, getTagProps) =>
        v.map((option, index) => (
          <GoTagWithTooltip
            goId={option.id}
            index={index}
            getTagProps={getTagProps}
            key={option.id}
          />
        ))
      }
    />
  )
}
