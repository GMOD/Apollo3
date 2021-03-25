import {
  Button,
  makeStyles,
  Paper,
  Toolbar,
  Tab,
  Tabs,
  Typography,
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

const useStyles = makeStyles(() => ({
  dataRow: {
    '&:hover': {
      backgroundColor: 'lightblue',
    },
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
        // case 'Go': {
        // }
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
  //    if (selectedAnnotationInfo != null) {
  //     exonDetailPanel.updateData(selectedAnnotationInfo);
  //     goPanel.updateData(selectedAnnotationInfo);
  //     geneProductPanel.updateData(selectedAnnotationInfo);
  //     provenancePanel.updateData(selectedAnnotationInfo);
  //     dbXrefPanel.updateData(selectedAnnotationInfo);
  //     commentPanel.updateData(selectedAnnotationInfo);
  //     attributePanel.updateData(selectedAnnotationInfo);
  // } else {
  //     exonDetailPanel.updateData();
  //     goPanel.updateData();
  //     geneProductPanel.updateData();
  //     provenancePanel.updateData();
  //     dbXrefPanel.updateData();
  //     commentPanel.updateData();
  //     attributePanel.updateData();
  // }
  const classes = useStyles()

  return (
    <>
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
              <Tabs
                value={idx}
                onChange={handleTabChange}
                indicatorColor="primary"
                variant="scrollable"
                scrollButtons="on"
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
                    />
                  )
                })}
              </Tabs>
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
