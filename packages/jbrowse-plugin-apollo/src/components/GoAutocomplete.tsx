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
import * as React from 'react'

import { AttributeValueEditorProps } from './ModifyFeatureAttribute'

interface GOValue {
  id: string
}

interface GOResult extends GOValue {
  label: string[]
  match: string
  category: string[]
  taxon: string
  taxon_label: string
  highlight: string
  has_highlight: boolean
}

interface GOResponse {
  docs: GOResult[]
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

  React.useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function fetchDescription() {
      try {
        const response = await fetch(
          `https://api.geneontology.org/api/ontology/term/${goId}`,
          { signal },
        )
        if (!response.ok) {
          const err = await response.text()
          throw new Error(
            `Failed to fetch plugin data: ${response.status} ${response.statusText} ${err}`,
          )
        }
        const goTerm = await response.json()
        const { label } = goTerm
        if (label && !signal.aborted) {
          setDescription(label)
        }
      } catch (e) {
        console.error(e)
      }
    }
    fetchDescription()

    return () => {
      controller.abort()
    }
  }, [goId])

  return (
    <Tooltip title={description}>
      <div>
        <Chip label={goId} size="small" {...getTagProps({ index })} />
      </div>
    </Tooltip>
  )
}

export function GoAutocomplete({
  value: initialValue,
  onChange,
}: AttributeValueEditorProps) {
  const [value, setValue] = React.useState<(GOValue | GOResult)[]>(
    initialValue.map((v) => ({ id: v })),
  )
  const [inputValue, setInputValue] = React.useState('')
  const [options, setOptions] = React.useState<readonly (GOValue | GOResult)[]>(
    [],
  )
  const [loading, setLoading] = React.useState(false)

  const goFetch = React.useMemo(
    () =>
      debounce(
        async (
          request: { input: string },
          callback: (results: GOResult[]) => void,
        ) => {
          const response = await fetch(
            `https://api.geneontology.org/api/search/entity/autocomplete/${request.input}?prefix=GO`,
          )
          const responseJson: GOResponse = await response.json()
          callback(responseJson.docs)
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

    goFetch({ input: inputValue }, (results) => {
      if (active) {
        let newOptions: readonly (GOValue | GOResult)[] = []

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
        <TextField {...params} variant="outlined" fullWidth />
      )}
      renderOption={(props, option) => {
        let parts =
          'match' in option ? [{ text: option.match, highlight: false }] : []
        if ('has_highlight' in option && option.has_highlight) {
          const highlightedText = option.highlight.match(hiliteRegex)
          if (highlightedText) {
            parts = option.highlight
              .split(/<em class="hilite">|<\/em>/)
              .map((part) => ({
                text: part,
                highlight: highlightedText.includes(part),
              }))
          }
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
