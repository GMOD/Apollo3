import { DataGrid } from '@material-ui/data-grid'
import {
  Button,
  makeStyles,
  Paper,
  Toolbar,
  Tab,
  Tabs,
  Typography,
  AppBar,
  TextField,
  MenuItem,
} from '@material-ui/core'
import { ToggleButton, ToggleButtonGroup } from '@material-ui/lab'
import { observer } from 'mobx-react'
import React, { useState } from 'react'
import { BaseCard } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import { AplInputProps, ApolloFeature } from '../ApolloFeatureDetail'
import DetailsEditingTabDetail from './DetailsEditingTabDetail'
import CodingEditingTabDetail from './CodingEditingTabDetail'
import GoEditingTabDetail from './GoEditingTabDetail'
import GeneProductEditingTabDetail from './GeneProductEditingTabDetail'
import ProvenanceEditingTabDetail from './ProvenanceEditingTabDetail'
import DbXrefEditingTabDetail from './DbXrefEditingTabDetail'
import CommentEditingTabDetail from './CommentEditingTabDetail'
import AttributeEditingTabDetail from './AttributeEditingTabDetail'

interface CodingRow {
  name: string
  seq: string
  type: string
  length: number
  updated: string
}

const useStyles = makeStyles(({ spacing, palette, breakpoints }) => ({
  dataRow: {
    '&:hover': {
      backgroundColor: 'lightblue',
    },
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
    fontSize: 12,
  },
}))

const AnnotationsTabDetail = ({
  aplData,
  props,
}: {
  aplData: ApolloFeature[]
  props: AplInputProps
}) => {
  const { model } = props
  const [clickedFeature, setClickedFeature] = useState<
    ApolloFeature | undefined
  >()
  const [currentEditingTabs, setCurrentEditingTabs] = useState([] as string[])
  const [idx, setIdx] = useState(0)
  const [type, setType] = useState('')
  const [users, setUsers] = useState('')
  const [status, setStatus] = useState('')
  const [filters, setFilters] = useState(() => [] as string[])

  const handleFilters = async (
    event: React.MouseEvent<HTMLElement>,
    newFilters: string[],
  ) => {
    setFilters(newFilters)
    model.fetchFeatureTree({
      showOnlyGoAnnotations: newFilters.includes('go'),
      showOnlyGeneProductAnnotations: newFilters.includes('gp'),
      showOnlyProvenanceAnnotations: newFilters.includes('provenance'),
    })
  }

  // generate the sub-editing tabs based on type
  const findEditingTabs = (type: string) => {
    switch (type) {
      case 'gene':
      case 'pseudogene':
      case 'pseudogenic_region':
      case 'processed_pseudogene':
        return [
          'Details',
          'Coding',
          'Go',
          'Gene Product',
          'Db Xref',
          'Comment',
          'Attributes',
        ]
      case 'transcript': {
        return [
          'Details',
          'Coding',
          'Go',
          'Gene Product',
          'Provenance',
          'Db Xref',
          'Comment',
          'Attributes',
        ]
      }
      case 'mRNA':
      case 'miRNA':
      case 'tRNA':
      case 'rRNA':
      case 'snRNA':
      case 'snoRNA':
      case 'ncRNA':
      case 'guide_RNA':
      case 'RNase_MRP_RNA':
      case 'telomerase_RNA':
      case 'SRP_RNA':
      case 'lnc_RNA':
      case 'RNase_P_RNA':
      case 'scRNA':
      case 'piRNA':
      case 'tmRNA':
      case 'enzymatic_RNA': {
        return [
          'Details',
          'Coding',
          'Go',
          'Gene Product',
          'Provenance',
          'Db Xref',
          'Comment',
          'Attributes',
        ]
      }
      case 'terminator':
      case 'transposable_element':
      case 'repeat_region': {
        return ['Details', 'Provenance', 'Db Xref', 'Comment', 'Attributes']
      }
      case 'deletion':
      case 'insertion':
      case 'SNV':
      case 'SNP':
      case 'MNV':
      case 'MNP':
      case 'indel': {
        return [
          'Details',
          'Alternate Alleles',
          'Variant Info',
          'Allele Info',
          'Db Xref',
          'Comment',
          'Attributes',
        ]
      }
      default:
        return []
    }
  }
  function handleTabChange(event: any, newIdx: any) {
    setIdx(newIdx)
  }
  // match tab index to editing panel
  function findMatchingEditingTab(tabIdx: number) {
    const key = currentEditingTabs[tabIdx]
    if (clickedFeature) {
      switch (key) {
        case 'Details': {
          return (
            <DetailsEditingTabDetail
              clickedFeature={clickedFeature}
              props={props}
            />
          )
        }
        case 'Coding': {
          return (
            <CodingEditingTabDetail
              clickedFeature={clickedFeature}
              props={props}
            />
          )
        }
        // case 'Alternate Alleles': {
        // }
        // case 'Variant Info': {
        // }
        // case 'Allele Info': {
        // }
        case 'Go': {
          return (
            <GoEditingTabDetail clickedFeature={clickedFeature} props={props} />
          )
        }
        case 'Gene Product': {
          return (
            <GeneProductEditingTabDetail
              clickedFeature={clickedFeature}
              props={props}
            />
          )
        }
        case 'Provenance': {
          return (
            <ProvenanceEditingTabDetail
              clickedFeature={clickedFeature}
              props={props}
            />
          )
        }
        case 'Db Xref': {
          return (
            <DbXrefEditingTabDetail
              clickedFeature={clickedFeature}
              props={props}
            />
          )
        }
        case 'Comment': {
          return (
            <CommentEditingTabDetail
              clickedFeature={clickedFeature}
              props={props}
            />
          )
        }
        case 'Attributes': {
          return (
            <AttributeEditingTabDetail
              clickedFeature={clickedFeature}
              props={props}
            />
          )
        }
        default:
          return
      }
    } else {
      return
    }
  }

  const classes = useStyles()
  const features = aplData
  const columns = [
    { field: 'name', headerName: 'Name' },
    { field: 'seq', headerName: 'Seq' },
    { field: 'type', headerName: 'Type' },
    { field: 'length', headerName: 'Length' },
    { field: 'updated', headerName: 'Updated' },
  ]

  const rows: CodingRow[] = features.map(
    (currentFeature: ApolloFeature, index: number) => ({
      id: index,
      name: currentFeature.name,
      seq: currentFeature.sequence,
      type: currentFeature.type.name,
      length: currentFeature.location.fmax - currentFeature.location.fmin,
      updated: new Date(currentFeature.date_last_modified).toDateString(),
    }),
  )
  return (
    <>
      {/* this contains the filter editing portion */}
      <div style={{ margin: 5 }}>
        <TextField
          label="Annotation Name"
          onChange={event => {
            model.fetchFeatureTree({ annotationName: event.target.value })
          }}
        />
        <TextField
          label="Reference Sequence"
          onChange={event => {
            model.fetchFeatureTree({ sequenceName: event.target.value })
          }}
        />

        <br />
        <TextField
          select
          value={type}
          onChange={event => {
            setType(event.target.value)
            model.fetchFeatureTree({ type: event.target.value })
          }}
        >
          <MenuItem value="">All Types </MenuItem>
          <MenuItem value="gene">Gene</MenuItem>
          <MenuItem value="pseudogene">Pseudogene</MenuItem>
          <MenuItem value="transposable_element">Transposable Element</MenuItem>
          <MenuItem value="terminator">Terminator</MenuItem>
          <MenuItem value="shine_dalgarno_sequence">
            Shine Dalgarno Sequence
          </MenuItem>
          <MenuItem value="repeat_region">Repeat Region</MenuItem>
          <MenuItem value="variant">Variant</MenuItem>
        </TextField>
        <TextField
          select
          value={users}
          onChange={event => {
            setUsers(event.target.value)
            model.fetchFeatureTree({ user: event.target.value })
          }}
          placeholder="All Users"
        >
          <MenuItem value="">All Users </MenuItem>
          {/* map thru users and create menu item for each one*/}
        </TextField>
        <TextField
          select
          value={status}
          onChange={event => {
            setStatus(event.target.value)
            model.fetchFeatureTree({ statusString: event.target.value })
          }}
          placeholder="All Statuses"
        >
          <MenuItem value="">All Statuses </MenuItem>
          <MenuItem value="no_status_assigned">No Status Assigned</MenuItem>
          <MenuItem value="any_status_assigned">Any Status Assigned</MenuItem>
        </TextField>
        <br />
        <ToggleButtonGroup value={filters} onChange={handleFilters}>
          <ToggleButton value="go">GO</ToggleButton>
          <ToggleButton value="gp">GP</ToggleButton>
          <ToggleButton value="provenance">Prov</ToggleButton>
        </ToggleButtonGroup>
      </div>
      <div style={{ height: clickedFeature ? 200 : 400, width: '100%' }}>
        <div style={{ display: 'flex', height: '100%' }}>
          <DataGrid
            className={classes.dataGrid}
            scrollbarSize={10}
            disableColumnMenu
            hideFooterSelectedRowCount
            pageSize={25}
            rows={rows}
            columns={columns}
            onRowClick={rowData => {
              setClickedFeature(features[rowData.row.id as number])
              setCurrentEditingTabs(findEditingTabs(rowData.row.type))
            }}
          />
        </div>
      </div>

      {clickedFeature ? (
        <BaseCard title={`${clickedFeature.name} Info`}>
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
                  {currentEditingTabs.map((tab: string, index: number) => {
                    return (
                      <Tab
                        key={`${tab}-${index}`}
                        label={
                          <div>
                            <Typography style={{ fontSize: 10 }}>
                              {tab}
                            </Typography>
                          </div>
                        }
                        tabIndex={idx}
                        className={classes.tabItemStyles}
                        classes={{ wrapper: classes.tabItemStylesWrapper }}
                      />
                    )
                  })}
                </Tabs>
              </AppBar>
            </Toolbar>
            <div>{findMatchingEditingTab(idx)}</div>
          </Paper>
        </BaseCard>
      ) : null}
      <Button
        color="secondary"
        variant="contained"
        onClick={async () => await model.fetchFeatures()}
      >
        Re-fetch
      </Button>
    </>
  )
}

export default observer(AnnotationsTabDetail)
