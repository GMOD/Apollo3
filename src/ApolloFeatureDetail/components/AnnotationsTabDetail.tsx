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
} from '@material-ui/core'
import { observer } from 'mobx-react'
import React, { useState } from 'react'
import { BaseCard } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import { toJS } from 'mobx'
import {
  AplInputProps,
  ApolloData,
  ApolloFeature,
} from '../ApolloFeatureDetail'
import DetailsEditingTabDetail from './DetailsEditingTabDetail'
import CodingEditingTabDetail from './CodingEditingTabDetail'
import GoEditingTabDetail from './GoEditingTabDetail'

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
}))

const AnnotationsTabDetail = ({
  aplData,
  props,
}: {
  aplData: ApolloData
  props: AplInputProps
}) => {
  const { model } = props
  const [clickedFeature, setClickedFeature] = useState<
    ApolloFeature | undefined
  >()
  const [currentEditingTabs, setCurrentEditingTabs] = useState([] as string[])
  const [idx, setIdx] = useState(0)

  // have a data structure with the arrays, instead of having a large switch case statement
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
          'DB Xref',
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
          'DB Xref',
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
          'DB Xref',
          'Comment',
          'Attributes',
        ]
      }
      case 'terminator':
      case 'transposable_element':
      case 'repeat_region': {
        return ['Details', 'Provenance', 'DB Xref', 'Comment', 'Attributes']
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
          'DB Xref',
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
        // case 'Gene Product': {
        // }
        // case 'Provenance': {
        // }
        // case 'Db Xref': {
        // }
        // case 'Comment': {
        // }
        // case 'Attributes': {
        // }
        default:
          return
      }
    } else {
      return
    }
  }

  const classes = useStyles()
  const columns = [
    { field: 'name', headerName: 'Name' },
    { field: 'seq', headerName: 'Seq' },
    { field: 'type', headerName: 'Type' },
    { field: 'length', headerName: 'Length' },
    { field: 'updated', headerName: 'Updated' },
    { field: 'feature', headerName: 'Feature', hide: true },
  ]

  const rows: CodingRow[] = Object.values(aplData)[0].map(
    (currentFeature: ApolloFeature) => ({
      name: currentFeature.name,
      seq: currentFeature.sequence,
      type: currentFeature.type.name,
      location: currentFeature.location.fmax - currentFeature.location.fmin,
      updated: new Date(currentFeature.date_last_modified).toDateString(),
      feature: currentFeature,
    }),
  )
  return (
    <>
      {/* <DataGrid
        rows={rows}
        columns={columns}
        onRowClick={rowData => {
          setClickedFeature(rowData.row.feature)
          setCurrentEditingTabs(findEditingTabs(rowData.row.type.name))
        }}
      /> */}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Seq</th>
            <th>Type</th>
            <th>Length</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(aplData)[0].map((currentFeature: ApolloFeature) => {
            const {
              name,
              sequence,
              type,
              location,
              date_last_modified,
            } = currentFeature
            return (
              <tr
                key={name}
                className={classes.dataRow}
                onClick={() => {
                  setClickedFeature(currentFeature)
                  setCurrentEditingTabs(
                    findEditingTabs(currentFeature.type.name),
                  )
                }}
              >
                <td>{name}</td>
                <td>{sequence}</td>
                <td>{type.name}</td>
                <td>{location.fmax - location.fmin}</td>
                <td>{new Date(date_last_modified).toDateString()}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

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
                            <Typography>{tab}</Typography>
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
