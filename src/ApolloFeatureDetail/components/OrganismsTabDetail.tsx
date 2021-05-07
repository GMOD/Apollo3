import { DataGrid } from '@material-ui/data-grid'
import {
  makeStyles,
  Paper,
  TextField,
  Button,
  IconButton,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'
import { observer } from 'mobx-react'
import React, { useEffect, useState } from 'react'
import { BaseCard } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import { AplInputProps } from '../ApolloFeatureDetail'
import OrganismModal from './OrganismModal'
import ConfirmDeleteModal from './ConfirmDeleteModal'

interface CodingRow {
  [key: string]: string | number
}

interface Organism {
  annotationCount: number
  blatdb?: string
  commonName: string
  currentOrganism: boolean
  directory: string
  genus: string
  id: number
  metadata: string
  nonDefaultTranslationTable?: any
  obsolete: boolean
  publicMode: boolean
  sequences: number
  species: string
  valid: boolean
}

const useStyles = makeStyles(({ spacing, palette, breakpoints }) => ({
  dataRow: {
    '&:hover': {
      backgroundColor: 'lightblue',
    },
  },
  buttons: {
    marginRight: 10,
  },
  tabStyles: {
    marginLeft: spacing(1),
  },
  tabStylesIndicator: {
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: palette.common.white,
  },
  tabItemStyles: {
    textTransform: 'initial',
    margin: spacing(0, 2),
    minWidth: 0,
    [breakpoints.up('md')]: {
      minWidth: 0,
    },
  },
  tabItemStylesWrapper: {
    fontWeight: 'normal',
    letterSpacing: 0.5,
  },
  dataGrid: {
    '& .MuiDataGrid-window': {
      overflowX: 'hidden',
    },
  },

  closeButton: {
    position: 'inherit',
    right: spacing(1),
    top: spacing(1),
    color: palette.grey[500],
  },
}))

const OrganismsTabDetail = ({
  aplData,
  props,
}: {
  aplData: Organism[]
  props: AplInputProps
}) => {
  const { model } = props
  const [clickedOrganism, setClickedOrganism] = useState<Organism | undefined>()

  const classes = useStyles()
  const organisms = aplData
  const columns = [
    { field: 'name', headerName: 'Name', flex: 2 },
    { field: 'annotations', headerName: 'Annotations', flex: 0.5 },
    { field: 'refSequences', headerName: 'Ref Sequences', flex: 0.5 },
  ]

  const [isPublic, setIsPublic] = useState(false)
  const [isObsolete, setIsObsolete] = useState(false)
  const [showObsolete, setShowObsolete] = useState(false)
  const [openModal, setOpenModal] = useState(false)
  const [openConfirmDeleteModal, setOpenConfirmDeleteModal] = useState(false)
  const [filterValue, setFilterValue] = useState('')

  const updateOrganismInfo = async (
    organism: any,
    field: string,
    value: string | number | boolean,
  ) => {
    organism[field] = value
    const data = {
      username: sessionStorage.getItem(`${model.apolloId}-apolloUsername`),
      password: sessionStorage.getItem(`${model.apolloId}-apolloPassword`),
      ...organism,
    }
    const endpointUrl = `${model.apolloUrl}/organism/updateOrganismInfo
    `
    await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
  }

  const handleClose = () => {
    setOpenModal(false)
  }

  const rows: CodingRow[] = organisms.map(
    (currentOrganism: Organism, index: number) => ({
      id: index,
      name: currentOrganism.commonName,
      annotations: currentOrganism.annotationCount,
      refSequences: currentOrganism.sequences,
    }),
  )

  useEffect(() => {
    if (clickedOrganism) {
      setIsPublic(clickedOrganism.publicMode)
      setIsObsolete(clickedOrganism.obsolete)

      console.log(clickedOrganism)
    }
  }, [clickedOrganism])

  return (
    <>
      <BaseCard title={'Filters'} defaultExpanded={false}>
        <div style={{ margin: 5 }}>
          <TextField
            label="Search Common Name"
            onChange={event => {
              setFilterValue(event.target.value)
            }}
          />{' '}
          <input
            id="Show Obsolete"
            type="checkbox"
            checked={showObsolete}
            onChange={async event => {
              setShowObsolete(event.target.checked)
              const data = {
                username: sessionStorage.getItem(
                  `${model.apolloId}-apolloUsername`,
                ),
                password: sessionStorage.getItem(
                  `${model.apolloId}-apolloPassword`,
                ),
                publicOnly: false,
                showObsolete,
              }
              await fetch(`${model.apolloUrl}/organism/findAllOrganisms`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
              })
            }}
            style={{ marginTop: 40 }}
          />
        </div>
        <label htmlFor="not">Show Obsolete</label>
      </BaseCard>
      <BaseCard title={'Organism Table'}>
        <div style={{ height: clickedOrganism ? 200 : 400 }}>
          <div style={{ display: 'flex', height: '100%' }}>
            <DataGrid
              className={classes.dataGrid}
              scrollbarSize={5}
              disableColumnMenu
              hideFooterSelectedRowCount
              pageSize={25}
              rows={rows}
              columns={columns}
              onRowClick={rowData => {
                setClickedOrganism(organisms[rowData.row.id as number])
              }}
              filterModel={{
                items: [
                  {
                    columnField: 'name',
                    operatorValue: 'contains',
                    value: filterValue,
                  },
                ],
              }}
            />
          </div>
        </div>

        <div style={{ margin: 5 }}>
          <Button
            color="secondary"
            variant="contained"
            className={classes.buttons}
            onClick={() => {
              setOpenModal(true)
            }}
          >
            Add
          </Button>
          <Button
            color="secondary"
            variant="contained"
            className={classes.buttons}
            onClick={() => {
              // open upload form
            }}
          >
            Upload
          </Button>
          <Button
            color="secondary"
            variant="contained"
            className={classes.buttons}
            disabled={!clickedOrganism}
            onClick={() => {
              setOpenConfirmDeleteModal(true)
            }}
          >
            Delete
          </Button>
          <Button
            color="secondary"
            variant="contained"
            className={classes.buttons}
            disabled={!clickedOrganism}
            onClick={async () => {
              const data = {
                username: sessionStorage.getItem(
                  `${model.apolloId}-apolloUsername`,
                ),
                password: sessionStorage.getItem(
                  `${model.apolloId}-apolloPassword`,
                ),
                ...clickedOrganism,
                commonName: `Copy of ${clickedOrganism?.commonName}`,
              }

              await fetch(`${model.apolloUrl}/organism/addOrganism`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
              })
            }}
          >
            Duplicate
          </Button>
          {openModal && (
            <OrganismModal handleClose={handleClose} model={model} />
          )}
          {openConfirmDeleteModal && (
            <ConfirmDeleteModal
              handleClose={() => setOpenConfirmDeleteModal(false)}
              deleteFunc={async () => {
                const data = {
                  username: sessionStorage.getItem(
                    `${model.apolloId}-apolloUsername`,
                  ),
                  password: sessionStorage.getItem(
                    `${model.apolloId}-apolloPassword`,
                  ),
                  ...clickedOrganism,
                }
                await fetch(`${model.apolloUrl}/organism/deleteOrganism`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(data),
                })
              }}
              objToDeleteName={`Organism: ${clickedOrganism?.commonName}`}
            />
          )}
        </div>
      </BaseCard>

      {clickedOrganism ? (
        <BaseCard title={`${clickedOrganism.commonName} Detail Info`}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <IconButton
              aria-label="close"
              className={classes.closeButton}
              onClick={() => setClickedOrganism(undefined)}
            >
              <CloseIcon /> Close
            </IconButton>
          </div>
          <Paper data-testid="apollo-editing-drawer">
            <div>
              <TextField
                key={`name-${clickedOrganism.commonName}`}
                label="Name"
                defaultValue={clickedOrganism.commonName}
                onBlur={async event => {
                  if (event.target.value !== clickedOrganism.commonName) {
                    updateOrganismInfo(
                      clickedOrganism,
                      'commonName',
                      event.target.value,
                    )
                  }
                }}
              />{' '}
              <TextField
                key={`genus-${clickedOrganism.genus}`}
                label="Genus"
                defaultValue={clickedOrganism.genus}
                onBlur={async event => {
                  if (event.target.value !== clickedOrganism.genus) {
                    updateOrganismInfo(
                      clickedOrganism,
                      'genus',
                      event.target.value,
                    )
                  }
                }}
              />{' '}
              <TextField
                key={`species-${clickedOrganism.species}`}
                label="Species"
                defaultValue={clickedOrganism.species}
                onBlur={async event => {
                  if (event.target.value !== clickedOrganism.species) {
                    updateOrganismInfo(
                      clickedOrganism,
                      'species',
                      event.target.value,
                    )
                  }
                }}
              />
              <br />
              <TextField
                disabled
                key={clickedOrganism.directory}
                label="Directory"
                defaultValue={clickedOrganism.directory}
                style={{ width: '80%' }}
                onBlur={async event => {
                  if (event.target.value !== clickedOrganism.directory) {
                    updateOrganismInfo(
                      clickedOrganism,
                      'directory',
                      event.target.value,
                    )
                  }
                }}
              />{' '}
              <br />
              <TextField
                key={`${clickedOrganism}-blatdb`}
                label="Search database"
                defaultValue={clickedOrganism.blatdb}
                style={{ width: '80%' }}
                onBlur={async event => {
                  if (event.target.value !== clickedOrganism.blatdb) {
                    updateOrganismInfo(
                      clickedOrganism,
                      'blatdb',
                      event.target.value,
                    )
                  }
                }}
              />
              <br />
              <TextField
                key={`${clickedOrganism}-translationtable`}
                label="Non-default Translation Table"
                defaultValue={clickedOrganism.nonDefaultTranslationTable}
                style={{ width: '80%' }}
                onBlur={async event => {
                  if (
                    event.target.value !==
                    clickedOrganism.nonDefaultTranslationTable
                  ) {
                    updateOrganismInfo(
                      clickedOrganism,
                      'nonDefaultTranslationTable',
                      event.target.value,
                    )
                  }
                }}
              />
              <br />
              <input
                id="Public"
                type="checkbox"
                checked={isPublic}
                onChange={event => {
                  setIsPublic(event.target.checked)
                  updateOrganismInfo(
                    clickedOrganism,
                    'publicMode',
                    event.target.checked,
                  )
                }}
                style={{ marginTop: 40 }}
              />
              <label htmlFor="not">Public</label>
              <input
                id="not"
                type="checkbox"
                checked={isObsolete}
                onChange={event => {
                  setIsObsolete(event.target.checked)
                  updateOrganismInfo(
                    clickedOrganism,
                    'obsolete',
                    event.target.checked,
                  )
                }}
                style={{ marginTop: 40 }}
              />
              <label htmlFor="not">Obsolete</label>
            </div>
          </Paper>
        </BaseCard>
      ) : null}
    </>
  )
}

export default observer(OrganismsTabDetail)
