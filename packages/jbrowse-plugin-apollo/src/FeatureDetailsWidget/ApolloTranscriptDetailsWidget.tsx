import { AbstractSessionModel, getSession } from '@jbrowse/core/util'
import { Key } from '@mui/icons-material'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  IconButton,
  Paper,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import {
  FeatureAttributeChange,
  LocationEndChange,
  LocationStartChange,
  StrandChange,
  TypeChange,
} from 'apollo-shared'
import { observer } from 'mobx-react'
import { IAnyStateTreeNode, getRoot, getSnapshot } from 'mobx-state-tree'
import React, { useMemo, useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { OntologyTermAutocomplete } from '../components/OntologyTermAutocomplete'
import { OntologyTermMultiSelect } from '../components/OntologyTermMultiSelect'
import { isOntologyClass } from '../OntologyManager'
import OntologyStore from '../OntologyManager/OntologyStore'
import { ApolloSessionModel } from '../session'
import { ApolloRootModel } from '../types'

const reservedKeys = new Map([
  [
    'Gene Ontology',
    (props: AttributeValueEditorProps) => {
      return <OntologyTermMultiSelect {...props} ontologyName="Gene Ontology" />
    },
  ],
  [
    'Sequence Ontology',
    (props: AttributeValueEditorProps) => {
      return (
        <OntologyTermMultiSelect {...props} ontologyName="Sequence Ontology" />
      )
    },
  ],
])

const useStyles = makeStyles()((theme) => ({
  attributeInput: {
    maxWidth: 400,
  },
  newAttributePaper: {
    padding: theme.spacing(2),
  },
  attributeName: {
    background: theme.palette.secondary.main,
    color: theme.palette.secondary.contrastText,
    padding: theme.spacing(1),
  },
}))

export interface AttributeValueEditorProps {
  session: ApolloSessionModel
  value: string[]
  onChange(newValue: string[]): void
}

const reservedTerms = [
  'ID',
  'Name',
  'Alias',
  'Target',
  'Gap',
  'Derives_from',
  'Note',
  'Dbxref',
  'Ontology',
  'Is_Circular',
]

function CustomAttributeValueEditor(props: AttributeValueEditorProps) {
  const { onChange, value } = props
  return (
    <TextField
      type="text"
      value={value}
      onChange={(event) => {
        onChange(event.target.value.split(','))
      }}
      variant="outlined"
      fullWidth
      helperText="Separate multiple values for the attribute with commas"
    />
  )
}

export interface GOTerm {
  id: string
  label: string
}
let error = false

export const ApolloTranscriptDetailsWidget = observer(
  function ApolloTranscriptDetails(props: { model: IAnyStateTreeNode }) {
    const { model } = props
    const { assembly, changeManager, feature, refName } = model
    const session = getSession(model) as unknown as AbstractSessionModel
    const apolloSession = getSession(model) as unknown as ApolloSessionModel
    const currentAssembly =
      apolloSession.apolloDataStore.assemblies.get(assembly)
    const refData = currentAssembly?.getByRefName(refName)
    const [showAddNewForm, setShowAddNewForm] = useState(false)
    const [newAttributeKey, setNewAttributeKey] = useState('')
    const { classes } = useStyles()
    const [errorMessage, setErrorMessage] = useState('')
    const [typeWarningText, setTypeWarningText] = useState('')
    const [showSequence, setShowSequence] = useState(false)
    const { notify } = session as unknown as AbstractSessionModel
    const { internetAccounts } = getRoot<ApolloRootModel>(session)
    const internetAccount = useMemo(() => {
      return internetAccounts.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ia: any) => ia.type === 'ApolloInternetAccount',
      ) as ApolloInternetAccountModel | undefined
    }, [internetAccounts])
    const role = internetAccount ? internetAccount.getRole() : 'admin'
    const editable = ['admin', 'user'].includes(role ?? '')

    const [featureId, setFeatureId] = useState(String(feature._id))
    const [end, setEnd] = useState(String(feature.end))
    const [start, setStart] = useState(String(feature.start + 1))
    const [type, setType] = useState(feature.type)
    const [strand, setStrand] = useState(String(feature.strand))
    // eslint-disable-next-line unicorn/consistent-function-scoping, @typescript-eslint/no-explicit-any
    const getStartEndArray = (feature: any, searchType: string): number[][] => {
      const result: number[][] = []
      // console.log('*** getStartEndArray alkaa...')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const traverse = (currentFeature: any, isParentMRNA: boolean) => {
        // console.log(`isParentmRNA: ${isParentMRNA}, featureId: ${feature._id}, current featureType: ${currentFeature.type}`)
        if (isParentMRNA && currentFeature.type === searchType) {
          // console.log('IF : Parent is mRNA and current type is CDS')
          result.push([
            currentFeature.start + 1,
            currentFeature.end,
            currentFeature._id,
          ])
        }
        if (currentFeature.children) {
          // console.log(`IF: feature has children: ${}`)
          for (const child of currentFeature.children) {
            // console.log(`FOR : child: ${child[1].type},  ${JSON.stringify(child[1])}`)
            traverse(child[1], feature.type === 'mRNA')
          }
        }
        // currentFeature.children?.forEach(child => traverse(child, currentFeature.type === 'mRNA'));
      }
      // console.log(`Traverse alkaa: ${feature.type}`)
      traverse(feature, feature.type === 'mRNA')
      // console.log('*** getStartEndArray paattyi...')
      return result
    }
    // setArrayCDS(getStartEndArray(feature, 'CDS'))

    const [arrayCDS, setArrayCDS] = useState<number[][]>(
      getStartEndArray(feature, 'CDS'),
    )
    const [array3UTR, setArray3UTR] = useState<number[][]>(
      getStartEndArray(feature, 'three_prime_UTR'),
    )
    const [array5UTR, setArray5UTR] = useState<number[][]>(
      getStartEndArray(feature, 'five_prime_UTR'),
    )
    const refSeq: string | undefined = refData?.getSequence(
      Number(feature.start + 1),
      Number(feature.end),
    )
    const [sequence, setSequence] = useState(refSeq)

    const [attributes, setAttributes] = useState<Record<string, string[]>>(
      Object.fromEntries(
        [...feature.attributes.entries()].map(([key, value]) => {
          if (key.startsWith('gff_')) {
            const newKey = key.slice(4)
            const capitalizedKey =
              newKey.charAt(0).toUpperCase() + newKey.slice(1)
            return [capitalizedKey, getSnapshot(value)]
          }
          if (key === '_id') {
            return ['ID', getSnapshot(value)]
          }
          return [key, getSnapshot(value)]
        }),
      ),
    )

    // User has selected another feature
    if (feature._id !== featureId) {
      setFeatureId(feature._id)
      setStart(feature.start)
      setEnd(feature.end)
      setType(feature.type)
      setStrand(String(feature.strand))
      setSequence(refSeq)
      setAttributes(
        Object.fromEntries(
          [...feature.attributes.entries()].map(([key, value]) => {
            if (key.startsWith('gff_')) {
              const newKey = key.slice(4)
              const capitalizedKey =
                newKey.charAt(0).toUpperCase() + newKey.slice(1)
              return [capitalizedKey, getSnapshot(value)]
            }
            if (key === '_id') {
              return ['ID', getSnapshot(value)]
            }
            return [key, getSnapshot(value)]
          }),
        ),
      )
    }

    // // eslint-disable-next-line @typescript-eslint/no-explicit-any, unicorn/consistent-function-scoping
    // const getStartEndArray = (features: any): number[][] => {
    //   const result: number[][] = []

    //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //   const traverse = (feature: any, isParentMRNA: boolean) => {
    //     if (isParentMRNA && feature.type === 'CDS') {
    //       result.push([feature.start, feature.end])
    //     }

    //     // eslint-disable-next-line prettier/prettier
    //       if (feature.children) {for (const child of feature.children) {traverse(child, feature.type === 'mRNA');}}
    //   }

    //   for (const feature of features) {
    //     traverse(feature, false)
    //   }
    //   return result
    // }

    // // eslint-disable-next-line unicorn/consistent-function-scoping, @typescript-eslint/no-explicit-any
    // const getStartEndArray = (feature: any, searchType: string): number[][] => {
    //   const result: number[][] = []
    //   // console.log('*** getStartEndArray alkaa...')

    //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //   const traverse = (currentFeature: any, isParentMRNA: boolean) => {
    //     // console.log(`isParentmRNA: ${isParentMRNA}, featureId: ${feature._id}, current featureType: ${currentFeature.type}`)
    //     if (isParentMRNA && currentFeature.type === searchType) {
    //       // console.log('IF : Parent is mRNA and current type is CDS')
    //       result.push([currentFeature.start + 1, currentFeature.end])
    //     }
    //     if (currentFeature.children) {
    //       // console.log(`IF: feature has children: ${}`)
    //       for (const child of currentFeature.children) {
    //         // console.log(`FOR : child: ${child[1].type},  ${JSON.stringify(child[1])}`)
    //         traverse(child[1], feature.type === 'mRNA')
    //       }
    //     }
    //     // currentFeature.children?.forEach(child => traverse(child, currentFeature.type === 'mRNA'));
    //   }
    //   // console.log(`Traverse alkaa: ${feature.type}`)
    //   traverse(feature, feature.type === 'mRNA')
    //   // console.log('*** getStartEndArray paattyi...')
    //   return result
    // }
    // setArrayCDS(getStartEndArray(feature, 'CDS'))
    // console.log(
    //   `CDS array: ${JSON.stringify(getStartEndArray(feature, 'CDS'))}`,
    // )
    // console.log(
    //   `3'UTR array: ${JSON.stringify(
    //     getStartEndArray(feature, 'three_prime_UTR'),
    //   )}`,
    // )
    // console.log(
    //   `5'UTR array: ${JSON.stringify(
    //     getStartEndArray(feature, 'five_prime_UTR'),
    //   )}`,
    // )
    // console.log(`CDS array: ${JSON.stringify(getStartEndArray(feature, 'CDS'))}`)

    const handleInputChange = (
      index: number,
      position: 'start' | 'end',
      value: string,
      id: string,
    ) => {
      // Create a new array with the updated values
      const newArray = arrayCDS.map((item, i) => {
        if (i === index) {
          error = Number(item[1]) <= Number(item[0])
          console.log(error)
          const updatedValue = Number.parseInt(value, 10)
          return position === 'start'
            ? [updatedValue, item[1]]
            : [item[0], updatedValue]
        }
        return item
      })
      // console.log(index, position, id, value)
      setArrayCDS(newArray)
    }

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault()
      setErrorMessage('')

      const attrs: Record<string, string[]> = {}
      if (attributes) {
        for (const [key, val] of Object.entries(attributes)) {
          if (!val) {
            continue
          }
          const newKey = key.toLowerCase()
          if (newKey === 'parent') {
            continue
          }
          if ([...reservedKeys.keys()].includes(key)) {
            attrs[key] = val
            continue
          }
          switch (key) {
            case 'ID': {
              attrs._id = val
              break
            }
            case 'Name': {
              attrs.gff_name = val
              break
            }
            case 'Alias': {
              attrs.gff_alias = val
              break
            }
            case 'Target': {
              attrs.gff_target = val
              break
            }
            case 'Gap': {
              attrs.gff_gap = val
              break
            }
            case 'Derives_from': {
              attrs.gff_derives_from = val
              break
            }
            case 'Note': {
              attrs.gff_note = val
              break
            }
            case 'Dbxref': {
              attrs.gff_dbxref = val
              break
            }
            case 'Ontology_term': {
              attrs.gff_ontology_term = val
              break
            }
            case 'Is_circular': {
              attrs.gff_is_circular = val
              break
            }
            default: {
              attrs[key.toLowerCase()] = val
            }
          }
        }
      }

      const change = new FeatureAttributeChange({
        changedIds: [feature._id],
        typeName: 'FeatureAttributeChange',
        assembly,
        featureId: feature._id,
        attributes: attrs,
      })
      await changeManager.submit?.(change)
      notify('Feature attributes modified successfully', 'success')
      event.preventDefault()
    }

    async function fetchValidDescendantTerms(
      parentFeature: AnnotationFeatureI | undefined,
      ontologyStore: OntologyStore,
      _signal: AbortSignal,
    ) {
      if (!parentFeature) {
        return
      }
      if (
        parentFeature?.children === undefined &&
        parentFeature?.parent === undefined
      ) {
        return // A single alone feature all types are allowed (for time beeing)
      }
      // since this is a child of an existing feature, restrict the autocomplete choices to valid
      // parts of that feature
      const parentTypeTerms = await ontologyStore.getTermsWithLabelOrSynonym(
        parentFeature.type,
        { includeSubclasses: false },
      )
      // eslint-disable-next-line unicorn/no-array-callback-reference
      const parentTypeClassTerms = parentTypeTerms.filter(isOntologyClass)
      if (parentTypeTerms.length === 0) {
        return
      }
      const subpartTerms = await ontologyStore.getClassesThat(
        'part_of',
        parentTypeClassTerms,
      )
      if (subpartTerms.length > 0) {
        setTypeWarningText('')
      } else {
        setTypeWarningText(
          `Type "${parentFeature.type}" does not have any children in the ontology`,
        )
      }
      return subpartTerms
    }

    async function onSubmitBasic(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault()
      setErrorMessage('')
      let changed = false
      let changedPosition = false

      if (feature.start !== Number(start)) {
        const change = new LocationStartChange({
          typeName: 'LocationStartChange',
          changedIds: [feature._id],
          featureId: feature._id,
          oldStart: Number(feature.start),
          newStart: Number(start),
          assembly,
        })
        await changeManager.submit?.(change)
        changed = true
        changedPosition = true
      }

      if (feature.end !== Number(end)) {
        const change = new LocationEndChange({
          typeName: 'LocationEndChange',
          changedIds: [feature._id],
          featureId: feature._id,
          oldEnd: Number(feature.end),
          newEnd: Number(end),
          assembly,
        })
        await changeManager.submit?.(change)
        changed = true
        changedPosition = true
      }

      if (feature.strand !== Number(strand)) {
        const change = new StrandChange({
          typeName: 'StrandChange',
          changedIds: [feature._id],
          featureId: feature._id,
          oldStrand:
            Number(feature.strand) === 1
              ? 1
              : Number(feature.strand) === -1
              ? -1
              : undefined,
          newStrand:
            Number(strand) === 1 ? 1 : Number(strand) === -1 ? -1 : undefined,
          assembly,
        })
        await changeManager.submit?.(change)
        changed = true
      }
      if (feature.type !== type) {
        const change = new TypeChange({
          typeName: 'TypeChange',
          changedIds: [feature._id],
          featureId: feature._id,
          oldType: feature.type,
          newType: type,
          assembly,
        })
        await changeManager.submit?.(change)
        changed = true
      }
      if (changedPosition) {
        const refSeq: string | undefined = refData?.getSequence(
          Number(feature.start + 1),
          Number(feature.end),
        )
        refSeq ? setSequence(refSeq) : null
      }
      changed ? notify('Feature data saved successfully', 'success') : null
      event.preventDefault()
    }

    function handleChangeType(newType: string) {
      setErrorMessage('')
      setType(newType)
    }
    function handleAddNewAttributeChange() {
      setErrorMessage('')
      if (newAttributeKey.trim().length === 0) {
        setErrorMessage('Attribute key is mandatory')
        return
      }
      if (newAttributeKey === 'Parent') {
        setErrorMessage(
          '"Parent" -key is handled internally and it cannot be modified manually',
        )
        return
      }
      if (newAttributeKey in attributes) {
        setErrorMessage(`Attribute "${newAttributeKey}" already exists`)
        return
      }
      if (
        /^[A-Z]/.test(newAttributeKey) &&
        !reservedTerms.includes(newAttributeKey) &&
        ![...reservedKeys.keys()].includes(newAttributeKey)
      ) {
        setErrorMessage(
          `Key cannot starts with uppercase letter unless key is one of these: ${reservedTerms.join(
            ', ',
          )}`,
        )
        return
      }
      setAttributes({ ...attributes, [newAttributeKey]: [] })
      setShowAddNewForm(false)
      setNewAttributeKey('')
    }

    function deleteAttribute(key: string) {
      setErrorMessage('')
      const { [key]: remove, ...rest } = attributes
      setAttributes(rest)
    }

    function makeOnChange(id: string) {
      return (newValue: string[]) => {
        setAttributes({ ...attributes, [id]: newValue })
      }
    }

    function handleRadioButtonChange(
      event: React.ChangeEvent<HTMLInputElement>,
      value: string,
    ) {
      if (value === 'custom') {
        setNewAttributeKey('')
      } else if (reservedKeys.has(value)) {
        setNewAttributeKey(value)
      } else {
        setErrorMessage('Unknown attribute type')
      }
    }

    const hasEmptyAttributes = Object.values(attributes).some(
      (value) => value.length === 0 || value.includes(''),
    )

    const handleSeqButtonClick = () => {
      setShowSequence(!showSequence)
    }

    // const error = Number(end) <= Number(start)
    const handleStrandChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      setStrand(event.target.value)
    }

    return (
      <>
        <form onSubmit={onSubmitBasic}>
          <h2 style={{ marginLeft: '15px', marginBottom: '0' }}>
            CDS and UTRs
          </h2>
          <div>
            {array5UTR.map((item, index) => (
              <div
                key={index}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <span style={{ marginLeft: '20px', width: '50px' }}>5 UTR</span>
                <TextField
                  margin="dense"
                  id="start"
                  label="Start"
                  style={{ width: '200px', marginLeft: '20px' }}
                  variant="outlined"
                  value={item[0]}
                  disabled
                />
                <span style={{ margin: '0 10px' }}>to</span>
                <TextField
                  margin="dense"
                  id="end"
                  label="End"
                  style={{ width: '200px' }}
                  variant="outlined"
                  value={item[1]}
                  disabled
                />
              </div>
            ))}
          </div>
          <div>
            {array3UTR.map((item, index) => (
              <div
                key={index}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <span style={{ marginLeft: '20px', width: '50px' }}>3 UTR</span>
                <TextField
                  margin="dense"
                  id="start"
                  label="Start"
                  style={{ width: '200px', marginLeft: '20px' }}
                  variant="outlined"
                  value={item[0]}
                  disabled
                />
                <span style={{ margin: '0 10px' }}>to</span>
                <TextField
                  margin="dense"
                  id="end"
                  label="End"
                  style={{ width: '200px' }}
                  variant="outlined"
                  value={item[1]}
                  disabled
                />
              </div>
            ))}
          </div>
          <div>
            {arrayCDS.map((item, index) => (
              <div
                key={index}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <span style={{ marginLeft: '20px', width: '50px' }}>CDS</span>
                <TextField
                  margin="dense"
                  id={String(item[2])}
                  label="Start"
                  type="number"
                  style={{ width: '200px', marginLeft: '20px' }}
                  variant="outlined"
                  value={item[0]}
                  onChange={(e) =>
                    handleInputChange(
                      index,
                      'start',
                      e.target.value,
                      e.target.id,
                    )
                  }
                />
                <span style={{ margin: '0 10px' }}>to</span>
                <TextField
                  margin="dense"
                  id={String(item[2])}
                  label="End"
                  type="number"
                  style={{ width: '200px' }}
                  variant="outlined"
                  value={item[1]}
                  error={error}
                  helperText={
                    error ? '"End" must be greater than "Start"' : null
                  }
                  onChange={(e) =>
                    handleInputChange(index, 'end', e.target.value, e.target.id)
                  }
                />
              </div>
            ))}
          </div>

          <DialogContent
            style={{
              display: 'flex',
              flexDirection: 'column',
              paddingTop: '0',
            }}
          >
            {/* <TextField
              margin="dense"
              id="start"
              label="Start"
              type="number"
              fullWidth
              variant="outlined"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <TextField
              margin="dense"
              id="end"
              label="End"
              type="number"
              fullWidth
              variant="outlined"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              error={error}
              helperText={error ? '"End" must be greater than "Start"' : null}
            /> */}
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              type="submit"
              disabled={error || !(start && end)}
            >
              Save
            </Button>
          </DialogActions>
        </form>
        <hr />
        <form onSubmit={onSubmit}>
          <h2 style={{ marginLeft: '15px', marginBottom: '0' }}>Attributes</h2>
          <DialogContent
            style={{
              display: 'flex',
              flexDirection: 'column',
              paddingTop: '0',
            }}
          >
            <Grid container direction="column" spacing={1}>
              {Object.entries(attributes).map(([key, value]) => {
                const EditorComponent =
                  reservedKeys.get(key) ?? CustomAttributeValueEditor
                return (
                  <Grid
                    container
                    item
                    spacing={3}
                    alignItems="center"
                    key={key}
                  >
                    <Grid item xs="auto">
                      <Paper
                        variant="outlined"
                        className={classes.attributeName}
                      >
                        <Typography>{key}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item flexGrow={1}>
                      <EditorComponent
                        session={apolloSession}
                        value={value}
                        onChange={makeOnChange(key)}
                      />
                    </Grid>
                    <Grid item xs={1}>
                      <IconButton
                        aria-label="delete"
                        size="medium"
                        disabled={!editable}
                        onClick={() => {
                          deleteAttribute(key)
                        }}
                      >
                        <DeleteIcon fontSize="medium" key={key} />
                      </IconButton>
                    </Grid>
                  </Grid>
                )
              })}
              <Grid item>
                <Button
                  color="primary"
                  variant="contained"
                  disabled={showAddNewForm || !editable}
                  onClick={() => {
                    setShowAddNewForm(true)
                  }}
                >
                  Add new
                </Button>
              </Grid>
              {showAddNewForm ? (
                <Grid item>
                  <Paper elevation={8} className={classes.newAttributePaper}>
                    <Grid container direction="column">
                      <Grid item>
                        <FormControl>
                          <FormLabel id="attribute-radio-button-group">
                            Select attribute type
                          </FormLabel>
                          <RadioGroup
                            aria-labelledby="demo-radio-buttons-group-label"
                            defaultValue="custom"
                            name="radio-buttons-group"
                            onChange={handleRadioButtonChange}
                          >
                            <FormControlLabel
                              value="custom"
                              control={<Radio />}
                              disableTypography
                              label={
                                <Grid container spacing={1} alignItems="center">
                                  <Grid item>
                                    <Typography>Custom</Typography>
                                  </Grid>
                                  <Grid item>
                                    <TextField
                                      label="Custom attribute key"
                                      variant="outlined"
                                      value={
                                        reservedKeys.has(newAttributeKey)
                                          ? ''
                                          : newAttributeKey
                                      }
                                      disabled={reservedKeys.has(
                                        newAttributeKey,
                                      )}
                                      onChange={(event) => {
                                        setNewAttributeKey(event.target.value)
                                      }}
                                    />
                                  </Grid>
                                </Grid>
                              }
                            />
                            {[...reservedKeys.keys()].map((key) => (
                              <FormControlLabel
                                key={key}
                                value={key}
                                control={<Radio />}
                                label={key}
                              />
                            ))}
                          </RadioGroup>
                        </FormControl>
                      </Grid>
                      <Grid item>
                        <DialogActions>
                          <Button
                            key="addButton"
                            color="primary"
                            variant="contained"
                            style={{ margin: 2 }}
                            onClick={handleAddNewAttributeChange}
                            disabled={!newAttributeKey}
                          >
                            Add
                          </Button>
                          <Button
                            key="cancelAddButton"
                            variant="outlined"
                            type="submit"
                            onClick={() => {
                              setShowAddNewForm(false)
                              setNewAttributeKey('')
                              setErrorMessage('')
                            }}
                          >
                            Cancel
                          </Button>
                        </DialogActions>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              ) : null}
            </Grid>
            {errorMessage ? (
              <DialogContentText color="error">
                {errorMessage}
              </DialogContentText>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              type="submit"
              disabled={showAddNewForm || hasEmptyAttributes || !editable}
            >
              Save
            </Button>
          </DialogActions>
        </form>
        <hr />
        <div>
          <h2 style={{ display: 'inline', marginLeft: '15px' }}>Sequence</h2>
          <Button
            variant="contained"
            style={{ marginLeft: '15px' }}
            onClick={handleSeqButtonClick}
          >
            {showSequence ? 'Hide sequence' : 'Show sequence'}
          </Button>
        </div>
        <div>
          {showSequence && (
            <textarea
              readOnly
              style={{
                marginLeft: '15px',
                height: '300px',
                width: '95%',
                resize: 'vertical',
                overflowY: 'scroll',
              }}
              value={sequence}
            />
          )}
        </div>
      </>
    )
  },
)
export default ApolloTranscriptDetailsWidget
