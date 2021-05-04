import { DataGrid } from '@material-ui/data-grid'
import {
  makeStyles,
  Paper,
  Toolbar,
  Tab,
  Tabs,
  Typography,
  AppBar,
  TextField,
  MenuItem,
  Button,
  IconButton,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'
import { ToggleButton, ToggleButtonGroup } from '@material-ui/lab'
import { observer } from 'mobx-react'
import React, { useState } from 'react'
import { BaseCard } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import { AplInputProps } from '../ApolloFeatureDetail'

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

  const [idx, setIdx] = useState(0)
  function handleTabChange(event: any, newIdx: any) {
    setIdx(newIdx)
  }

  const rows: CodingRow[] = organisms.map(
    (currentOrganism: Organism, index: number) => ({
      id: index,
      name: currentOrganism.commonName,
      annotations: currentOrganism.annotationCount,
      sequences: currentOrganism.sequences,
    }),
  )
  return (
    <>
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
            />
          </div>
        </div>

        <div style={{ margin: 5 }}>
          <Button
            color="secondary"
            variant="contained"
            className={classes.buttons}
            onClick={() => {
              //open an organism form
            }}
          >
            Add
          </Button>
          <Button
            color="secondary"
            variant="contained"
            className={classes.buttons}
            disabled={!clickedOrganism}
            onClick={() => {
              // send delete signal
            }}
          >
            Delete
          </Button>
          <Button
            color="secondary"
            variant="contained"
            className={classes.buttons}
            disabled={!clickedOrganism}
            onClick={() => {
              // duplicate
            }}
          >
            Duplicate
          </Button>
        </div>
      </BaseCard>

      {clickedOrganism ? (
        <BaseCard title={`${clickedOrganism.commonName} Info`}>
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
            <Toolbar disableGutters>
              <AppBar position={'static'}>
                <Tabs
                  value={idx}
                  onChange={handleTabChange}
                  className={classes.tabStyles}
                  classes={{
                    indicator: classes.tabStylesIndicator, //probably a better way to write this in makestyles
                  }}
                  variant="fullWidth"
                >
                  <Tab
                    key={idx}
                    label={
                      <div>
                        <Typography style={{ fontSize: 10 }}>
                          Details
                        </Typography>
                      </div>
                    }
                    tabIndex={idx}
                    className={classes.tabItemStyles}
                    classes={{ wrapper: classes.tabItemStylesWrapper }}
                  />
                </Tabs>
              </AppBar>
            </Toolbar>
            <div>
              <TextField
                key={clickedOrganism.commonName}
                label="Name"
                defaultValue={clickedOrganism.commonName}
                onBlur={async event => {
                  if (event.target.value !== clickedOrganism.commonName) {
                    // updateOrganismInfo
                  }
                }}
              />
              <br />
              <TextField
                key={clickedOrganism.genus}
                label="Genus"
                defaultValue={clickedOrganism.genus}
                onBlur={async event => {
                  if (event.target.value !== clickedOrganism.genus) {
                    // updateOrganismInfo
                  }
                }}
              />
              <br />
              <TextField
                key={clickedOrganism.species}
                label="Species"
                defaultValue={clickedOrganism.species}
                onBlur={async event => {
                  if (event.target.value !== clickedOrganism.species) {
                    // updateOrganismInfo
                  }
                }}
              />
              <br />
              <TextField
                disabled
                key={clickedOrganism.directory}
                label="Directory"
                defaultValue={clickedOrganism.directory}
                onBlur={async event => {
                  if (event.target.value !== clickedOrganism.directory) {
                    // updateOrganismInfo
                  }
                }}
              />
              <br />
              <TextField
                key={`${clickedOrganism}-blatdb`}
                label="Search database"
                defaultValue={clickedOrganism.blatdb}
                onBlur={async event => {
                  if (event.target.value !== clickedOrganism.blatdb) {
                    // updateOrganismInfo
                  }
                }}
              />
              <br />
              <TextField
                key={`${clickedOrganism}-translationtable`}
                label="Non-default Translation Table"
                defaultValue={clickedOrganism.nonDefaultTranslationTable}
                onBlur={async event => {
                  if (
                    event.target.value !==
                    clickedOrganism.nonDefaultTranslationTable
                  ) {
                    // updateOrganismInfo
                  }
                }}
              />
              <br />
            </div>
          </Paper>
        </BaseCard>
      ) : null}
    </>
  )
}

export default observer(OrganismsTabDetail)
