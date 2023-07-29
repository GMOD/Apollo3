import { getSession } from '@jbrowse/core/util'
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
import { getParent } from 'mobx-state-tree'
import * as React from 'react'

import { OntologyManager, OntologyRecord } from '../OntologyManager'

interface TermValue {
  id: string
}

interface TermAutocompleteResult extends TermValue {
  label: string[]
  match: string
  category: string[]
  taxon: string
  taxon_label: string
  highlight: string
  has_highlight: boolean
}

interface TermAutocompleteResponse {
  docs: TermAutocompleteResult[]
}

const hiliteRegex = /(?<=<em class="hilite">)(.*?)(?=<\/em>)/g

function TermTagWithTooltip({
  termId,
  index,
  getTagProps,
  ontology,
}: {
  termId: string
  index: number
  getTagProps: AutocompleteRenderGetTagProps
  ontology: OntologyRecord
}) {
  const manager = getParent<OntologyManager>(ontology, 2)

  const [description, setDescription] = React.useState('')
  const [errorMessage, setErrorMessage] = React.useState('')

  React.useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function fetchDescription() {
      const termUrl = manager.expandPrefixes(termId)
      const db = await ontology.dataStore?.db
      if (!db || signal.aborted) {
        return
      }
      const term = await db
        .transaction('nodes')
        .objectStore('nodes')
        .get(termUrl)

      if (term && term.lbl && !signal.aborted) {
        setDescription(term.lbl || 'no label')
      }
    }
    fetchDescription().catch((e) => {
      if (!signal.aborted) {
        setErrorMessage(String(e))
      }
    })

    return () => {
      controller.abort()
    }
  }, [termId, ontology, manager])

  return (
    <Tooltip title={description}>
      <div>
        <Chip
          label={errorMessage || termId}
          color={errorMessage ? 'error' : 'default'}
          size="small"
          {...getTagProps({ index })}
        />
      </div>
    </Tooltip>
  )
}

export function OntologyTermMultiSelect({
  value: initialValue,
  session,
  onChange,
  ontologyName,
  ontologyVersion,
}: {
  session: ReturnType<typeof getSession>
  value: string[]
  ontologyName: string
  ontologyVersion?: string
  onChange(newValue: string[]): void
}) {
  const ontologyManager = session.apolloDataStore
    .ontologyManager as OntologyManager
  const ontology = ontologyManager.findOntology(ontologyName, ontologyVersion)

  const [value, setValue] = React.useState<
    (TermValue | TermAutocompleteResult)[]
  >(initialValue.map((v) => ({ id: v })))
  const [inputValue, setInputValue] = React.useState('')
  const [options, setOptions] = React.useState<
    readonly (TermValue | TermAutocompleteResult)[]
  >([])
  const [loading, setLoading] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState('')

  const goFetch = React.useMemo(
    () =>
      debounce(
        async (
          request: { input: string },
          callback: (results: TermAutocompleteResult[]) => void,
        ) => {
          try {
            const response = await fetch(
              `https://api.geneontology.org/api/search/entity/autocomplete/${request.input}?prefix=GO`,
            )
            const responseJson: TermAutocompleteResponse = await response.json()
            callback(responseJson.docs)
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
        let newOptions: readonly (TermValue | TermAutocompleteResult)[] = []
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

  if (!ontology) {
    return null
  }

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
        }
        // } else if ('label' in option) {
        //   const matches = match(option.label, inputValue, { insideWords: true })
        //   parts = parse(option.label, matches)
        // }
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
          <TermTagWithTooltip
            termId={option.id}
            index={index}
            ontology={ontology}
            getTagProps={getTagProps}
            key={option.id}
          />
        ))
      }
    />
  )
}
