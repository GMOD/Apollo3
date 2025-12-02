/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/use-unknown-in-catch-callback-variable */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { isAbortException } from '@jbrowse/core/util/aborting'
import {
  Autocomplete,
  type AutocompleteRenderValueGetItemProps,
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
  type OntologyManager,
  type OntologyRecord,
  type OntologyTerm,
  isOntologyClass,
} from '../OntologyManager'
import { type Match } from '../OntologyManager/OntologyStore/fulltext'
import { isDeprecated } from '../OntologyManager/OntologyStore/indexeddb-schema'
import { type ApolloSessionModel } from '../session'

interface TermValue {
  term: OntologyTerm
  matches?: Match[]
}

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
  getItemProps,
  index,
  ontology,
  termId,
}: {
  termId: string
  index: number
  getItemProps: AutocompleteRenderValueGetItemProps<true>
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
    fetchDescription().catch((error) => {
      if (!signal.aborted) {
        setErrorMessage(String(error))
      }
    })

    return () => {
      controller.abort('TermTagWithTooltip ')
    }
  }, [termId, ontology, manager])

  return (
    <Tooltip title={description}>
      <div>
        <Chip
          label={errorMessage || manager.applyPrefixes(termId)}
          color={errorMessage ? 'error' : 'default'}
          size="small"
          {...getItemProps({ index })}
        />
      </div>
    </Tooltip>
  )
}

export function OntologyTermMultiSelect({
  includeDeprecated,
  onChange,
  ontologyName,
  ontologyVersion,
  session,
  value: initialValue,
  label,
}: {
  session: ApolloSessionModel
  value: string[]
  ontologyName: string
  ontologyVersion?: string
  /** if true, include deprecated/obsolete terms */
  includeDeprecated?: boolean
  onChange(newValue: string[]): void
  label?: string
}) {
  const { ontologyManager } = session.apolloDataStore
  const ontology = ontologyManager.findOntology(ontologyName, ontologyVersion)

  const [value, setValue] = React.useState<TermValue[]>(
    initialValue.map((id) => ({ term: { id, type: 'CLASS' } })),
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
          callback: (results: TermValue[]) => void,
        ) => {
          if (!ontology) {
            return
          }
          const { dataStore } = ontology
          if (!dataStore) {
            return
          }
          const { input, signal } = request
          try {
            const matches = await dataStore.getTermsByFulltext(
              input,
              undefined,
              signal,
            )
            // aggregate the matches by term
            const byTerm = new Map<string, Required<TermValue>>()
            const options: Required<TermValue>[] = []
            for (const match of matches) {
              if (
                !isOntologyClass(match.term) ||
                (!includeDeprecated && isDeprecated(match.term))
              ) {
                continue
              }
              let slot = byTerm.get(match.term.id)
              if (!slot) {
                slot = { term: match.term, matches: [] }
                byTerm.set(match.term.id, slot)
                options.push(slot)
              }
              slot.matches.push(match)
            }
            callback(options)
          } catch (error) {
            if (!isAbortException(error)) {
              setErrorMessage(String(error))
            }
          }
        },
        400,
      ),
    [includeDeprecated, ontology],
  )

  React.useEffect(() => {
    const aborter = new AbortController()
    const { signal } = aborter

    if (inputValue === '') {
      setOptions([])
      return
    }

    setLoading(true)

    void getOntologyTerms({ input: inputValue, signal }, (results) => {
      let newOptions: readonly TermValue[] = []
      if (value.length > 0) {
        newOptions = value
      }
      if (results) {
        newOptions = [...newOptions, ...results]
      }
      setOptions(newOptions)
      setLoading(false)
    })

    return () => {
      aborter.abort('OntologyTermMultiSelect')
    }
  }, [getOntologyTerms, ontology, includeDeprecated, inputValue, value])

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
      getOptionLabel={(option) => ontologyManager.applyPrefixes(option.term.id)}
      filterOptions={(terms) => terms.filter((t) => isOntologyClass(t.term))}
      options={options}
      autoComplete
      includeInputInList
      filterSelectedOptions
      value={value}
      loading={loading}
      isOptionEqualToValue={(option, v) =>
        ontologyManager.applyPrefixes(option.term.id) ===
        ontologyManager.applyPrefixes(v.term.id)
      }
      noOptionsText={inputValue ? 'No matches' : 'Start typing to search'}
      onChange={(_, newValue) => {
        setOptions(newValue ? [...newValue, ...options] : options)
        onChange(newValue.map((v) => ontologyManager.applyPrefixes(v.term.id)))
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
          label={label}
          fullWidth
        />
      )}
      renderOption={(props, option) => (
        <Option
          {...props}
          ontologyManager={ontologyManager}
          option={option}
          inputValue={inputValue}
        />
      )}
      renderValue={(v, getItemProps) =>
        v.map((option, index) => (
          <TermTagWithTooltip
            termId={option.term.id}
            index={index}
            ontology={ontology}
            getItemProps={getItemProps}
            key={option.term.id}
          />
        ))
      }
    />
  )
}

function HighlightedText(props: { str: string; search: string }) {
  const { search, str } = props

  const highlights = highlightMatch(str, search, {
    insideWords: true,
    findAllOccurrences: true,
  })
  const parts = highlightParse(str, highlights)
  return (
    <>
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
    </>
  )
}
function Option(props: {
  ontologyManager: OntologyManager
  inputValue: string
  option: TermValue
}) {
  const { inputValue, ontologyManager, option, ...other } = props
  const matches = option.matches ?? []
  const fields = matches
    .filter((match) => match.field.jsonPath !== '$.lbl')
    .map((match) => {
      return (
        <React.Fragment key={`option-${match.term.id}-${match.str}`}>
          <Typography component="dt" variant="body2" color="text.secondary">
            {match.field.displayName}
          </Typography>
          <dd>
            <HighlightedText str={match.str} search={inputValue} />
          </dd>
        </React.Fragment>
      )
    })
  // const lblScore = matches
  //   .filter((match) => match.field.jsonPath === '$.lbl')
  //   .map((m) => m.score)
  //   .join(', ')
  return (
    <li {...other}>
      <Grid container>
        <Grid>
          <Typography component="span">
            {ontologyManager.applyPrefixes(option.term.id)}
          </Typography>{' '}
          <HighlightedText
            str={option.term.lbl ?? '(no label)'}
            search={inputValue}
          />{' '}
          {/* ({lblScore}) */}
          <dl>{fields}</dl>
        </Grid>
      </Grid>
    </li>
  )
}
