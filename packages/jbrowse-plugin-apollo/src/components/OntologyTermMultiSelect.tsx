import { getSession, isAbortException } from '@jbrowse/core/util'
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
import highlightMatch from 'autosuggest-highlight/match'
import highlightParse from 'autosuggest-highlight/parse'
import { getParent } from 'mobx-state-tree'
import * as React from 'react'

import {
  OntologyManager,
  OntologyRecord,
  OntologyTerm,
  isOntologyClass,
} from '../OntologyManager'
import { OntologyDBNode } from '../OntologyManager/OntologyStore/indexeddb-schema'

type TermValue = OntologyTerm

// interface TermAutocompleteResult extends TermValue {
//   label: string[]
//   match: string
//   category: string[]
//   taxon: string
//   taxon_label: string
//   highlight: string
//   has_highlight: boolean
// }

// interface TermAutocompleteResponse {
//   docs: TermAutocompleteResult[]
// }

// const hiliteRegex = /(?<=<em class="hilite">)(.*?)(?=<\/em>)/g

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
          label={errorMessage || manager.applyPrefixes(termId)}
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

  const [value, setValue] = React.useState<OntologyTerm[]>(
    initialValue.map((id) => ({ id, type: 'CLASS' })),
  )
  const [inputValue, setInputValue] = React.useState('')
  const [options, setOptions] = React.useState<readonly TermValue[]>([])
  const [loading, setLoading] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState('')

  const getOntologyTerms = React.useMemo(
    () =>
      debounce(
        async (
          request: { input: string; signal: AbortSignal },
          callback: (results: OntologyDBNode[]) => void,
        ) => {
          if (!ontology) {
            return undefined
          }
          const { dataStore } = ontology
          if (!dataStore) {
            return undefined
          }
          const { input, signal } = request
          try {
            const matches: OntologyTerm[] = []
            const tx = (await dataStore.db).transaction('nodes')
            for await (const cursor of tx.objectStore('nodes')) {
              if (signal.aborted) {
                return
              }
              const node = cursor.value
              if (
                (node.lbl ?? '').toLowerCase().includes(input.toLowerCase())
              ) {
                matches.push(node)
              }
            }
            callback(matches)
          } catch (error) {
            setErrorMessage(String(error))
          }
        },
        400,
      ),
    [ontology],
  )

  React.useEffect(() => {
    const aborter = new AbortController()
    const { signal } = aborter

    if (inputValue === '') {
      setOptions([])
      return undefined
    }

    setLoading(true)

    if (!ontology) {
      return undefined
    }
    const { dataStore } = ontology
    if (!dataStore) {
      return undefined
    }

    ;(async () => {
      const matches = await dataStore.getTermsByFulltext(
        inputValue,
        undefined,
        signal,
      )
      setOptions(matches.map((m) => m[1]).filter(isOntologyClass))
      setLoading(false)
    })().catch((error) => {
      if (!isAbortException(error)) {
        setErrorMessage(String(error))
      }
    })

    return () => {
      aborter.abort()
    }
  }, [getOntologyTerms, ontology, inputValue, value])

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
      filterOptions={(terms) => terms.filter(isOntologyClass)}
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
        onChange(newValue.map((v) => ontologyManager.applyPrefixes(v.id)))
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
        const label = option.lbl ?? '(no label)'
        const matches = highlightMatch(label, inputValue, {
          insideWords: true,
          findAllOccurrences: true,
        })
        parts = highlightParse(label, matches)
        return (
          <li {...props}>
            <Grid container>
              <Grid item>
                <Typography>
                  {ontologyManager.applyPrefixes(option.id)}
                </Typography>
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
