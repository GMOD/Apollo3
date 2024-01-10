import {
  AbstractSessionModel,
  SessionWithWidgets,
  getSession,
} from '@jbrowse/core/util'
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
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  SelectChangeEvent,
  TextField,
  Typography,
} from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import { AddFeatureChange, FeatureAttributeChange } from 'apollo-shared'
import { observer } from 'mobx-react'
import { IAnyStateTreeNode, getRoot, getSnapshot } from 'mobx-state-tree'
import React, { useMemo, useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { ChangeManager } from '../ChangeManager'
import { OntologyTermMultiSelect } from '../components/OntologyTermMultiSelect'
import { ApolloSessionModel } from '../session'
import { ApolloRootModel } from '../types'

interface ModifyFeatureAttributeProps {
  session: ApolloSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeatureI
  sourceAssemblyId: string
  changeManager: ChangeManager
}

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
    maxWidth: 600,
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

export const ApolloFeatureDetailsWidget = observer(
  function ApolloFeatureDetails(props: { model: IAnyStateTreeNode }) {
    const { model } = props
    const { assembly, changeManager, feature, session } = model
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.log('**** Apollo feature details... ***')
    console.log(`MODEL: ${JSON.stringify(model)}`)
    console.log(`Assembly: ${assembly}`)
    console.log(`Feature: ${JSON.stringify(feature)}`)
    console.log(`Session: ${JSON.stringify(session)}`)
    console.log(`ChangeManager: ${JSON.stringify(changeManager)}`)

    const [end, setEnd] = useState(String(feature.end))
    const [start, setStart] = useState(String(feature.start + 1))
    const [strand, setStrand] = useState(feature.strand)
    const [errorMessage, setErrorMessage] = useState('')

    /*
    const { notify } = session as unknown as AbstractSessionModel
console.log('1')
    const { internetAccounts } = getRoot<ApolloRootModel>(session)
console.log('2')


    const internetAccount = useMemo(() => {
      return internetAccounts.find(
        (ia) => ia.type === 'ApolloInternetAccount',
      ) as ApolloInternetAccountModel | undefined
    }, [internetAccounts])
    const role = internetAccount ? internetAccount.role : 'admin'
    const editable = ['admin', 'user'].includes(role ?? '')
*/
    const editable = true // tilapainen TRUE arvo

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

    const [showAddNewForm, setShowAddNewForm] = useState(false)
    const [newAttributeKey, setNewAttributeKey] = useState('')
    const { classes } = useStyles()
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
      // notify('Feature attributes modified successfully', 'success')
      handleClose()
      event.preventDefault()
    }

    // async function onSubmitBasic(event: React.FormEvent<HTMLFormElement>) {
    //   event.preventDefault()
    //   setErrorMessage('')
    //   const change = new AddFeatureChange({
    //     changedIds: [feature._id],
    //     typeName: 'AddFeatureChange',
    //     assembly: assembly,
    //     addedFeature: {
    //       _id: new ObjectID().toHexString(),
    //       gffId: '',
    //       refSeq: sourceFeature.refSeq,
    //       start: Number(start) - 1,
    //       end: Number(end),
    //       type,
    //       phase: phaseAsNumber,
    //     },
    //     parentFeatureId: sourceFeature._id,
    //   })
    //   await changeManager.submit?.(change)
    //   notify('Feature added successfully', 'success')
    //   handleClose()
    //   event.preventDefault()
    // }
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

    // eslint-disable-next-line unicorn/consistent-function-scoping
    const handleClose = () => {
      console.log('Handle close...')
      // setOpen(false);
    }

    async function handleChangeStrand(e: SelectChangeEvent<string>) {
      setErrorMessage('')
      setStrand(e.target.value)
      switch (e.target.value) {
        case '+': {
          setStrand('0')
          break
        }
        case '-': {
          setStrand('1')
          break
        }
        default: {
          setStrand('')
        }
      }
    }
    const error = Number(end) <= Number(start)
    let errorStrand = true
    if (strand === '+' || strand === '-' || strand === '') {
      errorStrand = false
    }
    return (
      <form onSubmit={onSubmit}>
        <h2>Basic information</h2>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <TextField
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
          />
          <TextField
            margin="dense"
            id="strand"
            label="Strand"
            type="string"
            fullWidth
            variant="outlined"
            value={strand}
            onChange={(e) => setStrand(e.target.value)}
            error={errorStrand}
            helperText={errorStrand ? 'Possible strand values are "+" or "-" or empty' : null}
          />
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            type="submit"
            disabled={error || errorStrand || !(start && end)}
          >
            Save
          </Button>
        </DialogActions>
        <h2>Attributes</h2>
        <DialogContent>
          <Grid container direction="column" spacing={1}>
            {Object.entries(attributes).map(([key, value]) => {
              const EditorComponent =
                reservedKeys.get(key) ?? CustomAttributeValueEditor
              return (
                <Grid container item spacing={3} alignItems="center" key={key}>
                  <Grid item xs="auto">
                    <Paper variant="outlined" className={classes.attributeName}>
                      <Typography>{key}</Typography>
                    </Paper>
                  </Grid>
                  <Grid item flexGrow={1}>
                    <EditorComponent
                      session={session}
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
                                    disabled={reservedKeys.has(newAttributeKey)}
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
            <DialogContentText color="error">{errorMessage}</DialogContentText>
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
    )
  },
)
export default ApolloFeatureDetailsWidget
